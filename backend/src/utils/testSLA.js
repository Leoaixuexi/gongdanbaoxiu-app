/**
 * SLA Service Test Utility
 *
 * This utility can be used to test SLA calculations manually
 * Run with: node src/utils/testSLA.js
 */

require('dotenv').config();
const slaService = require('../services/slaService');
const { WorkOrder, SLARule, sequelize } = require('../models');
const logger = require('./logger');

/**
 * Test SLA deadline calculation
 */
async function testCalculateSLADeadline() {
  console.log('\n=== Testing SLA Deadline Calculation ===\n');

  const mockWorkOrder = {
    id: 999,
    priority: 'High',
    created_at: new Date(),
  };

  try {
    const deadline = await slaService.calculateSLADeadline(mockWorkOrder);
    console.log('Mock Work Order:', {
      id: mockWorkOrder.id,
      priority: mockWorkOrder.priority,
      created_at: mockWorkOrder.created_at.toISOString(),
    });
    console.log('Calculated Deadline:', deadline.toISOString());
    console.log('Hours until deadline:', ((deadline - mockWorkOrder.created_at) / (1000 * 60 * 60)).toFixed(2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

/**
 * Test SLA warning threshold
 */
async function testGetSLAWarningThreshold() {
  console.log('\n=== Testing SLA Warning Threshold ===\n');

  const now = new Date();
  const deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

  const mockWorkOrder = {
    id: 999,
    priority: 'Normal',
    created_at: now,
    sla_deadline: deadline,
  };

  try {
    const warningThreshold = await slaService.getSLAWarningThreshold(mockWorkOrder);
    console.log('Mock Work Order:', {
      created_at: mockWorkOrder.created_at.toISOString(),
      deadline: mockWorkOrder.sla_deadline.toISOString(),
      totalHours: 24,
    });
    console.log('Warning Threshold:', warningThreshold.toISOString());
    console.log('Hours until warning:', ((warningThreshold - now) / (1000 * 60 * 60)).toFixed(2));
    console.log('Threshold percentage:', (((warningThreshold - now) / (deadline - now)) * 100).toFixed(0) + '%');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

/**
 * Test SLA status check with different scenarios
 */
async function testCheckSLAStatus() {
  console.log('\n=== Testing SLA Status Check ===\n');

  const now = new Date();

  // Scenario 1: Order is fine (50% time used)
  const scenario1 = {
    id: 1001,
    order_number: 'WO-TEST-0001',
    priority: 'Normal',
    created_at: new Date(now.getTime() - 12 * 60 * 60 * 1000), // Created 12 hours ago
    sla_deadline: new Date(now.getTime() + 12 * 60 * 60 * 1000), // Deadline in 12 hours
  };

  // Scenario 2: Order is in warning zone (85% time used)
  const scenario2 = {
    id: 1002,
    order_number: 'WO-TEST-0002',
    priority: 'High',
    created_at: new Date(now.getTime() - 17 * 60 * 60 * 1000), // Created 17 hours ago
    sla_deadline: new Date(now.getTime() + 3 * 60 * 60 * 1000), // Deadline in 3 hours (85% used)
  };

  // Scenario 3: Order is overdue
  const scenario3 = {
    id: 1003,
    order_number: 'WO-TEST-0003',
    priority: 'Emergency',
    created_at: new Date(now.getTime() - 26 * 60 * 60 * 1000), // Created 26 hours ago
    sla_deadline: new Date(now.getTime() - 2 * 60 * 60 * 1000), // Deadline was 2 hours ago
  };

  const scenarios = [scenario1, scenario2, scenario3];

  for (const order of scenarios) {
    try {
      console.log(`\nScenario: Order ${order.order_number}`);
      console.log('Created:', order.created_at.toISOString());
      console.log('Deadline:', order.sla_deadline.toISOString());

      const status = await slaService.checkSLAStatus(order);
      console.log('SLA Status:', status);
    } catch (error) {
      console.error('Error:', error.message);
    }
  }
}

/**
 * Test with real database data
 */
async function testWithRealData() {
  console.log('\n=== Testing with Real Database Data ===\n');

  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('Database connected\n');

    // Fetch a sample work order
    const workOrder = await WorkOrder.findOne({
      where: {
        status: {
          [sequelize.Sequelize.Op.ne]: 'Completed',
        },
      },
      order: [['created_at', 'DESC']],
    });

    if (!workOrder) {
      console.log('No active work orders found in database');
      return;
    }

    console.log('Testing with Work Order:', {
      id: workOrder.id,
      order_number: workOrder.order_number,
      priority: workOrder.priority,
      status: workOrder.status,
      created_at: workOrder.created_at.toISOString(),
      sla_deadline: workOrder.sla_deadline.toISOString(),
    });

    // Test SLA status
    const status = await slaService.checkSLAStatus(workOrder);
    console.log('\nSLA Status:', status);

    // Get warning threshold
    const warningThreshold = await slaService.getSLAWarningThreshold(workOrder);
    console.log('\nWarning Threshold:', warningThreshold.toISOString());

    // Show SLA rules
    console.log('\n=== Current SLA Rules ===');
    const slaRules = await SLARule.findAll({
      where: { active: true },
      order: [['priority', 'ASC']],
    });

    slaRules.forEach((rule) => {
      console.log(`${rule.priority}: ${rule.target_resolution_hours}h resolution, ${rule.escalation_threshold_pct}% escalation threshold`);
    });
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('========================================');
  console.log('   SLA Service Test Utility');
  console.log('========================================');

  await testCalculateSLADeadline();
  await testGetSLAWarningThreshold();
  await testCheckSLAStatus();

  // Test with real data if database is available
  if (process.env.DB_HOST && process.env.DB_NAME) {
    await testWithRealData();
  } else {
    console.log('\n=== Skipping Real Database Tests ===');
    console.log('Database configuration not found');
  }

  console.log('\n========================================');
  console.log('   Tests Completed');
  console.log('========================================\n');
}

// Run tests if executed directly
if (require.main === module) {
  runTests()
    .then(() => {
      console.log('All tests finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = {
  testCalculateSLADeadline,
  testGetSLAWarningThreshold,
  testCheckSLAStatus,
  testWithRealData,
};
