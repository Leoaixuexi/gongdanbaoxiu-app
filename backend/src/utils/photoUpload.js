const COS = require('cos-nodejs-sdk-v5');
const crypto = require('crypto');
const path = require('path');
const logger = require('./logger');
const { MAX_PHOTO_SIZE_MB } = require('./constants');

/**
 * Photo Upload Utility for Tencent Cloud Object Storage (COS)
 *
 * Provides secure photo upload functionality using pre-signed URLs.
 * Features:
 * - Pre-signed URL generation for direct client upload
 * - File type validation (images only)
 * - Unique filename generation
 * - Photo deletion
 * - URL validation
 * - Comprehensive error handling
 *
 * Security:
 * - Pre-signed URLs expire after 15 minutes
 * - Only accepts image file types
 * - Validates file size limits
 * - Restricted to specific COS bucket and paths
 *
 * Usage:
 * 1. Client requests pre-signed URL
 * 2. Client uploads directly to COS using the URL
 * 3. Client stores the final URL in work order photos_json
 */

// Validate COS configuration
const validateCOSConfig = () => {
  const requiredVars = ['COS_SECRET_ID', 'COS_SECRET_KEY', 'COS_BUCKET', 'COS_REGION'];
  const missing = requiredVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    logger.error('Missing COS configuration', { missing });
    throw new Error(`Missing COS configuration: ${missing.join(', ')}`);
  }
};

// Initialize COS client
let cosClient = null;
const getCOSClient = () => {
  if (!cosClient) {
    validateCOSConfig();

    cosClient = new COS({
      SecretId: process.env.COS_SECRET_ID,
      SecretKey: process.env.COS_SECRET_KEY,
    });

    logger.info('COS client initialized', {
      region: process.env.COS_REGION,
      bucket: process.env.COS_BUCKET,
    });
  }

  return cosClient;
};

/**
 * Allowed image MIME types
 */
const ALLOWED_MIME_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Generate a pre-signed URL for photo upload
 *
 * Creates a temporary URL that allows direct upload to COS.
 * The URL expires after 15 minutes for security.
 *
 * @param {string} fileType - MIME type of the file (e.g., 'image/jpeg')
 * @param {number} userId - ID of the user uploading the photo
 * @param {number} fileSizeBytes - Size of the file in bytes (optional, for validation)
 * @returns {Promise<Object>} Object containing presignedUrl, key, and expiresIn
 * @throws {Error} If file type is invalid or generation fails
 */
const generatePresignedUrl = async (fileType, userId, fileSizeBytes = null) => {
  try {
    // Validate inputs
    if (!fileType) {
      throw new Error('File type is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    // Validate file type
    const fileExtension = ALLOWED_MIME_TYPES[fileType];
    if (!fileExtension) {
      logger.warn('Invalid file type for upload', { fileType, userId });
      throw new Error(
        `Invalid file type: ${fileType}. Allowed types: ${Object.keys(ALLOWED_MIME_TYPES).join(', ')}`
      );
    }

    // Validate file size if provided
    if (fileSizeBytes) {
      const maxSizeBytes = MAX_PHOTO_SIZE_MB * 1024 * 1024;
      if (fileSizeBytes > maxSizeBytes) {
        throw new Error(
          `File size exceeds maximum allowed size of ${MAX_PHOTO_SIZE_MB}MB`
        );
      }
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const filename = `${timestamp}_${randomString}.${fileExtension}`;
    const key = `workorders/${userId}/${filename}`;

    logger.debug('Generating pre-signed URL', {
      userId,
      fileType,
      filename,
      key,
    });

    // Get COS client
    const cos = getCOSClient();

    // Generate pre-signed URL for PUT operation (15 minutes expiry)
    const expiresInSeconds = 15 * 60; // 15 minutes
    const url = await new Promise((resolve, reject) => {
      cos.getObjectUrl(
        {
          Bucket: process.env.COS_BUCKET,
          Region: process.env.COS_REGION,
          Key: key,
          Method: 'PUT',
          Expires: expiresInSeconds,
          Sign: true,
        },
        (err, data) => {
          if (err) {
            reject(err);
          } else {
            resolve(data.Url);
          }
        }
      );
    });

    logger.info('Pre-signed URL generated successfully', {
      userId,
      filename,
      expiresInSeconds,
    });

    return {
      presignedUrl: url,
      key,
      filename,
      expiresIn: expiresInSeconds,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
    };
  } catch (error) {
    logger.error('Failed to generate pre-signed URL', {
      userId,
      fileType,
      error: error.message,
      stack: error.stack,
    });
    throw new Error(`Failed to generate pre-signed URL: ${error.message}`);
  }
};

/**
 * Validate that a photo URL is from the configured COS bucket
 *
 * Ensures that URLs stored in work orders are legitimate COS URLs
 * and not arbitrary external links.
 *
 * @param {string} url - URL to validate
 * @returns {boolean} True if URL is valid, false otherwise
 */
const validatePhotoUrl = (url) => {
  try {
    if (!url || typeof url !== 'string') {
      return false;
    }

    // Check if URL is from our COS domain
    const bucket = process.env.COS_BUCKET;
    const region = process.env.COS_REGION;

    if (!bucket || !region) {
      logger.warn('COS configuration not available for URL validation');
      return false;
    }

    // Tencent Cloud COS URL format: https://{bucket}.cos.{region}.myqcloud.com/{key}
    const cosDomain = `${bucket}.cos.${region}.myqcloud.com`;

    const isValid = url.includes(cosDomain) && url.startsWith('https://');

    if (!isValid) {
      logger.debug('Invalid photo URL detected', {
        url: url.substring(0, 100),
        expectedDomain: cosDomain,
      });
    }

    return isValid;
  } catch (error) {
    logger.error('Error validating photo URL', {
      url: url ? url.substring(0, 100) : null,
      error: error.message,
    });
    return false;
  }
};

/**
 * Delete a photo from COS
 *
 * Removes a photo file from the COS bucket.
 * Used when work orders are deleted or photos are replaced.
 *
 * @param {string} url - Full URL of the photo to delete
 * @returns {Promise<boolean>} True if deletion successful
 * @throws {Error} If deletion fails
 */
const deletePhoto = async (url) => {
  try {
    if (!url) {
      throw new Error('Photo URL is required');
    }

    // Validate URL is from our COS
    if (!validatePhotoUrl(url)) {
      throw new Error('Invalid photo URL - not from configured COS bucket');
    }

    // Extract key from URL
    const key = extractKeyFromUrl(url);
    if (!key) {
      throw new Error('Could not extract key from photo URL');
    }

    logger.debug('Deleting photo from COS', { url: url.substring(0, 100), key });

    // Get COS client
    const cos = getCOSClient();

    // Delete object
    await new Promise((resolve, reject) => {
      cos.deleteObject(
        {
          Bucket: process.env.COS_BUCKET,
          Region: process.env.COS_REGION,
          Key: key,
        },
        (err, data) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        }
      );
    });

    logger.info('Photo deleted successfully from COS', {
      url: url.substring(0, 100),
      key,
    });

    return true;
  } catch (error) {
    logger.error('Failed to delete photo from COS', {
      url: url ? url.substring(0, 100) : null,
      error: error.message,
      stack: error.stack,
    });
    throw new Error(`Failed to delete photo: ${error.message}`);
  }
};

/**
 * Delete multiple photos from COS
 *
 * Batch deletion of photos. Used when deleting work orders with multiple photos.
 *
 * @param {Array<string>} urls - Array of photo URLs to delete
 * @returns {Promise<Object>} Object with success count and failed URLs
 */
const deletePhotos = async (urls) => {
  try {
    if (!Array.isArray(urls) || urls.length === 0) {
      return { success: 0, failed: 0, errors: [] };
    }

    logger.info('Deleting multiple photos from COS', { count: urls.length });

    // Delete each photo
    const results = await Promise.allSettled(
      urls.map(async (url) => {
        try {
          await deletePhoto(url);
          return { url, success: true };
        } catch (error) {
          return { url, success: false, error: error.message };
        }
      })
    );

    // Analyze results
    const successCount = results.filter(
      (r) => r.status === 'fulfilled' && r.value.success
    ).length;
    const failedResults = results
      .filter((r) => r.status === 'rejected' || !r.value.success)
      .map((r) =>
        r.status === 'rejected'
          ? { url: 'unknown', error: r.reason.message }
          : { url: r.value.url, error: r.value.error }
      );

    logger.info('Batch photo deletion completed', {
      total: urls.length,
      success: successCount,
      failed: failedResults.length,
    });

    return {
      success: successCount,
      failed: failedResults.length,
      errors: failedResults,
    };
  } catch (error) {
    logger.error('Batch photo deletion failed', {
      urlCount: urls ? urls.length : 0,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Extract key from COS URL
 *
 * @private
 * @param {string} url - Full COS URL
 * @returns {string|null} Extracted key or null if extraction fails
 */
const extractKeyFromUrl = (url) => {
  try {
    const bucket = process.env.COS_BUCKET;
    const region = process.env.COS_REGION;
    const cosDomain = `${bucket}.cos.${region}.myqcloud.com`;

    // URL format: https://{bucket}.cos.{region}.myqcloud.com/{key}
    const urlObj = new URL(url);
    if (!urlObj.hostname.includes(cosDomain)) {
      return null;
    }

    // Remove leading slash
    const key = urlObj.pathname.substring(1);
    return key;
  } catch (error) {
    logger.error('Failed to extract key from URL', {
      url: url ? url.substring(0, 100) : null,
      error: error.message,
    });
    return null;
  }
};

/**
 * Get public URL for a photo key
 *
 * Constructs the public URL for a given COS key.
 * Note: This assumes the bucket has public read access or appropriate permissions.
 *
 * @param {string} key - COS object key
 * @returns {string} Public URL
 */
const getPublicUrl = (key) => {
  try {
    if (!key) {
      throw new Error('Key is required');
    }

    validateCOSConfig();

    const bucket = process.env.COS_BUCKET;
    const region = process.env.COS_REGION;

    // Tencent Cloud COS public URL format
    const url = `https://${bucket}.cos.${region}.myqcloud.com/${key}`;

    return url;
  } catch (error) {
    logger.error('Failed to generate public URL', {
      key,
      error: error.message,
    });
    throw error;
  }
};

/**
 * Check if a photo exists in COS
 *
 * @param {string} url - Photo URL
 * @returns {Promise<boolean>} True if photo exists
 */
const photoExists = async (url) => {
  try {
    if (!url || !validatePhotoUrl(url)) {
      return false;
    }

    const key = extractKeyFromUrl(url);
    if (!key) {
      return false;
    }

    const cos = getCOSClient();

    // HEAD request to check if object exists
    const exists = await new Promise((resolve) => {
      cos.headObject(
        {
          Bucket: process.env.COS_BUCKET,
          Region: process.env.COS_REGION,
          Key: key,
        },
        (err, data) => {
          if (err) {
            resolve(false);
          } else {
            resolve(!!data);
          }
        }
      );
    });

    return exists;
  } catch (error) {
    logger.error('Error checking photo existence', {
      url: url ? url.substring(0, 100) : null,
      error: error.message,
    });
    return false;
  }
};

module.exports = {
  generatePresignedUrl,
  validatePhotoUrl,
  deletePhoto,
  deletePhotos,
  getPublicUrl,
  photoExists,
};
