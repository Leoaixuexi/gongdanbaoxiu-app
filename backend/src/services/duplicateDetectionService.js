const { WorkOrder, User, FaultType } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

/**
 * Duplicate Detection Service (T149a-T149b)
 * Implements fuzzy matching algorithm to identify potential duplicate work orders
 * Uses location similarity, fault type matching, and time proximity
 */

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching of location strings
 *
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Edit distance between strings
 */
const levenshteinDistance = (str1, str2) => {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) {
    matrix[i][0] = i;
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
};

/**
 * Calculate similarity percentage between two strings
 *
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score (0-100)
 */
const calculateStringSimilarity = (str1, str2) => {
  if (!str1 || !str2) return 0;

  // Normalize strings: lowercase and trim
  const normalized1 = str1.toLowerCase().trim();
  const normalized2 = str2.toLowerCase().trim();

  if (normalized1 === normalized2) return 100;

  const maxLength = Math.max(normalized1.length, normalized2.length);
  if (maxLength === 0) return 100;

  const distance = levenshteinDistance(normalized1, normalized2);
  const similarity = ((maxLength - distance) / maxLength) * 100;

  return Math.round(similarity);
};

/**
 * Calculate time proximity score
 * Orders submitted closer in time get higher scores
 *
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {number} Time proximity score (0-100)
 */
const calculateTimeProximity = (date1, date2) => {
  const diffMs = Math.abs(new Date(date1) - new Date(date2));
  const diffHours = diffMs / (1000 * 60 * 60);

  // Within 1 hour: 100% score
  // Within 24 hours: 50-100% score (linear decay)
  // Beyond 24 hours: 0% score
  if (diffHours <= 1) {
    return 100;
  } else if (diffHours <= 24) {
    return Math.round(100 - ((diffHours - 1) / 23) * 50);
  } else {
    return 0;
  }
};

/**
 * Calculate overall similarity score between two work orders
 * Combines location similarity, fault type match, and time proximity
 *
 * @param {Object} order1 - First work order
 * @param {Object} order2 - Second work order
 * @returns {number} Overall similarity score (0-100)
 */
const calculateSimilarityScore = (order1, order2) => {
  // Location similarity (40% weight)
  const locationScore = calculateStringSimilarity(
    `${order1.floor} ${order1.location}`,
    `${order2.floor} ${order2.location}`
  );

  // Fault type match (35% weight)
  const faultTypeScore = order1.fault_type_id === order2.fault_type_id ? 100 : 0;

  // Time proximity (25% weight)
  const timeScore = calculateTimeProximity(order1.created_at, order2.created_at);

  // Weighted average
  const overallScore = (
    locationScore * 0.40 +
    faultTypeScore * 0.35 +
    timeScore * 0.25
  );

  return Math.round(overallScore);
};

/**
 * Find potential duplicate work orders for a given order
 * Returns work orders with similarity score > 75%
 *
 * @param {number} workOrderId - ID of the work order to check
 * @returns {Promise<Array>} Array of potential duplicates with similarity scores
 */
const findPotentialDuplicates = async (workOrderId) => {
  try {
    // Get the target work order
    const targetOrder = await WorkOrder.findByPk(workOrderId, {
      include: [
        {
          model: User,
          as: 'submitter',
          attributes: ['id', 'name'],
        },
        {
          model: FaultType,
          as: 'fault_type',
          attributes: ['id', 'name'],
        },
      ],
    });

    if (!targetOrder) {
      throw new Error('Work order not found');
    }

    // Find work orders within 24 hours time window
    const timeWindowStart = new Date(targetOrder.created_at);
    timeWindowStart.setHours(timeWindowStart.getHours() - 24);

    const timeWindowEnd = new Date(targetOrder.created_at);
    timeWindowEnd.setHours(timeWindowEnd.getHours() + 24);

    // Find candidate work orders (excluding the target order)
    const candidates = await WorkOrder.findAll({
      where: {
        id: {
          [Op.ne]: workOrderId,
        },
        created_at: {
          [Op.between]: [timeWindowStart, timeWindowEnd],
        },
        // Optionally filter by same fault type for efficiency
        fault_type_id: targetOrder.fault_type_id,
      },
      include: [
        {
          model: User,
          as: 'submitter',
          attributes: ['id', 'name'],
        },
        {
          model: FaultType,
          as: 'fault_type',
          attributes: ['id', 'name'],
        },
      ],
    });

    // Calculate similarity scores and filter by threshold
    const duplicates = [];
    for (const candidate of candidates) {
      const score = calculateSimilarityScore(targetOrder, candidate);

      if (score >= 75) {
        duplicates.push({
          work_order: {
            id: candidate.id,
            order_number: candidate.order_number,
            floor: candidate.floor,
            location: candidate.location,
            fault_type: candidate.fault_type,
            status: candidate.status,
            priority: candidate.priority,
            created_at: candidate.created_at,
            submitter: candidate.submitter,
          },
          similarity_score: score,
          match_details: {
            location_similarity: calculateStringSimilarity(
              `${targetOrder.floor} ${targetOrder.location}`,
              `${candidate.floor} ${candidate.location}`
            ),
            same_fault_type: targetOrder.fault_type_id === candidate.fault_type_id,
            time_proximity: calculateTimeProximity(
              targetOrder.created_at,
              candidate.created_at
            ),
          },
        });
      }
    }

    // Sort by similarity score (highest first)
    duplicates.sort((a, b) => b.similarity_score - a.similarity_score);

    logger.info('Duplicate detection completed', {
      workOrderId,
      candidatesChecked: candidates.length,
      duplicatesFound: duplicates.length,
    });

    return duplicates;
  } catch (error) {
    logger.error('Error in findPotentialDuplicates', {
      workOrderId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Find all duplicate groups within a date range
 * Groups work orders that are potential duplicates of each other
 *
 * @param {Object} options - Date range and filters
 * @param {Date} options.startDate - Start date for search
 * @param {Date} options.endDate - End date for search
 * @param {number} options.minSimilarity - Minimum similarity threshold (default 75)
 * @returns {Promise<Array>} Array of duplicate groups
 */
const getAllDuplicateGroups = async ({ startDate, endDate, minSimilarity = 75 }) => {
  try {
    // Get all work orders in the date range
    const workOrders = await WorkOrder.findAll({
      where: {
        created_at: {
          [Op.between]: [startDate, endDate],
        },
      },
      include: [
        {
          model: User,
          as: 'submitter',
          attributes: ['id', 'name'],
        },
        {
          model: FaultType,
          as: 'fault_type',
          attributes: ['id', 'name'],
        },
      ],
      order: [['created_at', 'ASC']],
    });

    if (workOrders.length === 0) {
      return [];
    }

    // Track which orders have been grouped
    const grouped = new Set();
    const duplicateGroups = [];

    // Compare each order with all subsequent orders
    for (let i = 0; i < workOrders.length; i++) {
      if (grouped.has(workOrders[i].id)) continue;

      const group = {
        primary_order: {
          id: workOrders[i].id,
          order_number: workOrders[i].order_number,
          floor: workOrders[i].floor,
          location: workOrders[i].location,
          fault_type: workOrders[i].fault_type,
          status: workOrders[i].status,
          created_at: workOrders[i].created_at,
          submitter: workOrders[i].submitter,
        },
        duplicates: [],
      };

      for (let j = i + 1; j < workOrders.length; j++) {
        if (grouped.has(workOrders[j].id)) continue;

        const score = calculateSimilarityScore(workOrders[i], workOrders[j]);

        if (score >= minSimilarity) {
          group.duplicates.push({
            work_order: {
              id: workOrders[j].id,
              order_number: workOrders[j].order_number,
              floor: workOrders[j].floor,
              location: workOrders[j].location,
              fault_type: workOrders[j].fault_type,
              status: workOrders[j].status,
              created_at: workOrders[j].created_at,
              submitter: workOrders[j].submitter,
            },
            similarity_score: score,
          });
          grouped.add(workOrders[j].id);
        }
      }

      // Only add group if it has duplicates
      if (group.duplicates.length > 0) {
        grouped.add(workOrders[i].id);
        duplicateGroups.push(group);
      }
    }

    logger.info('Duplicate group detection completed', {
      dateRange: { startDate, endDate },
      totalOrders: workOrders.length,
      groupsFound: duplicateGroups.length,
    });

    return duplicateGroups;
  } catch (error) {
    logger.error('Error in getAllDuplicateGroups', {
      dateRange: { startDate, endDate },
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

module.exports = {
  findPotentialDuplicates,
  getAllDuplicateGroups,
  calculateSimilarityScore,
  calculateStringSimilarity,
};
