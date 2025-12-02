const { assignWorkOrder } = require('../../../src/services/assignmentService');
const { User, WorkOrder } = require('../../../src/models');
const { ROLES, MAX_CONCURRENT_ORDERS_PER_TECHNICIAN } = require('../../../src/utils/constants');

// Mock dependencies
jest.mock('../../../src/models');
jest.mock('../../../src/utils/logger');

describe('AssignmentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('assignWorkOrder', () => {
    it('should throw error if workOrderId is missing', async () => {
      await expect(assignWorkOrder(null, 1)).rejects.toThrow(
        'Work order ID is required for assignment'
      );
    });

    it('should throw error if no active maintenance workers found', async () => {
      User.findAll = jest.fn().mockResolvedValue([]);

      await expect(assignWorkOrder(1, 1)).rejects.toThrow(
        'No active maintenance workers available for assignment'
      );

      expect(User.findAll).toHaveBeenCalledWith({
        where: {
          role_id: ROLES.MAINTENANCE_WORKER,
          active: true,
        },
        attributes: ['id', 'name', 'contact_phone', 'department'],
        order: [['id', 'ASC']],
      });
    });

    it('should assign to technician with no active orders', async () => {
      const mockWorkers = [
        { id: 1, name: 'Worker 1', contact_phone: '111', department: 'Dept A' },
        { id: 2, name: 'Worker 2', contact_phone: '222', department: 'Dept B' },
        { id: 3, name: 'Worker 3', contact_phone: '333', department: 'Dept C' },
      ];

      User.findAll = jest.fn().mockResolvedValue(mockWorkers);

      // Worker 1: 0 orders, Worker 2: 2 orders, Worker 3: 1 order
      WorkOrder.count = jest.fn()
        .mockResolvedValueOnce(0) // Worker 1
        .mockResolvedValueOnce(2) // Worker 2
        .mockResolvedValueOnce(1); // Worker 3

      const result = await assignWorkOrder(1, 1);

      expect(result).toEqual(mockWorkers[0]); // Should assign to Worker 1 (0 orders)
      expect(WorkOrder.count).toHaveBeenCalledTimes(3);
    });

    it('should assign to technician with least active orders', async () => {
      const mockWorkers = [
        { id: 1, name: 'Worker 1', contact_phone: '111', department: 'Dept A' },
        { id: 2, name: 'Worker 2', contact_phone: '222', department: 'Dept B' },
        { id: 3, name: 'Worker 3', contact_phone: '333', department: 'Dept C' },
      ];

      User.findAll = jest.fn().mockResolvedValue(mockWorkers);

      // Worker 1: 3 orders, Worker 2: 1 order, Worker 3: 2 orders
      WorkOrder.count = jest.fn()
        .mockResolvedValueOnce(3) // Worker 1
        .mockResolvedValueOnce(1) // Worker 2
        .mockResolvedValueOnce(2); // Worker 3

      const result = await assignWorkOrder(1, 1);

      expect(result).toEqual(mockWorkers[1]); // Should assign to Worker 2 (1 order)
    });

    it('should throw error if all workers are at maximum capacity', async () => {
      const mockWorkers = [
        { id: 1, name: 'Worker 1', contact_phone: '111', department: 'Dept A' },
        { id: 2, name: 'Worker 2', contact_phone: '222', department: 'Dept B' },
      ];

      User.findAll = jest.fn().mockResolvedValue(mockWorkers);

      // All workers at max capacity (5 orders each)
      WorkOrder.count = jest.fn()
        .mockResolvedValueOnce(MAX_CONCURRENT_ORDERS_PER_TECHNICIAN) // Worker 1
        .mockResolvedValueOnce(MAX_CONCURRENT_ORDERS_PER_TECHNICIAN); // Worker 2

      await expect(assignWorkOrder(1, 1)).rejects.toThrow(
        `All maintenance workers are at maximum capacity (${MAX_CONCURRENT_ORDERS_PER_TECHNICIAN} concurrent orders)`
      );
    });

    it('should assign to worker with capacity when others are at max', async () => {
      const mockWorkers = [
        { id: 1, name: 'Worker 1', contact_phone: '111', department: 'Dept A' },
        { id: 2, name: 'Worker 2', contact_phone: '222', department: 'Dept B' },
        { id: 3, name: 'Worker 3', contact_phone: '333', department: 'Dept C' },
      ];

      User.findAll = jest.fn().mockResolvedValue(mockWorkers);

      // Worker 1: at max (5), Worker 2: at max (5), Worker 3: has capacity (2)
      WorkOrder.count = jest.fn()
        .mockResolvedValueOnce(MAX_CONCURRENT_ORDERS_PER_TECHNICIAN) // Worker 1
        .mockResolvedValueOnce(MAX_CONCURRENT_ORDERS_PER_TECHNICIAN) // Worker 2
        .mockResolvedValueOnce(2); // Worker 3

      const result = await assignWorkOrder(1, 1);

      expect(result).toEqual(mockWorkers[2]); // Should assign to Worker 3
    });

    it('should use user ID as tiebreaker when workers have same active order count', async () => {
      const mockWorkers = [
        { id: 3, name: 'Worker 3', contact_phone: '333', department: 'Dept C' },
        { id: 1, name: 'Worker 1', contact_phone: '111', department: 'Dept A' },
        { id: 2, name: 'Worker 2', contact_phone: '222', department: 'Dept B' },
      ];

      User.findAll = jest.fn().mockResolvedValue(mockWorkers);

      // All workers have same count (2 orders each)
      WorkOrder.count = jest.fn()
        .mockResolvedValueOnce(2) // Worker 3
        .mockResolvedValueOnce(2) // Worker 1
        .mockResolvedValueOnce(2); // Worker 2

      const result = await assignWorkOrder(1, 1);

      // Should assign to Worker 1 (lowest user ID when counts are equal)
      expect(result).toEqual(mockWorkers[1]);
    });

    it('should query work orders with correct status filter', async () => {
      const mockWorkers = [
        { id: 1, name: 'Worker 1', contact_phone: '111', department: 'Dept A' },
      ];

      User.findAll = jest.fn().mockResolvedValue(mockWorkers);
      WorkOrder.count = jest.fn().mockResolvedValue(0);

      await assignWorkOrder(1, 1);

      expect(WorkOrder.count).toHaveBeenCalledWith({
        where: {
          assigned_technician_id: 1,
          status: 'In Progress',
        },
      });
    });

    it('should handle single maintenance worker scenario', async () => {
      const mockWorkers = [
        { id: 1, name: 'Worker 1', contact_phone: '111', department: 'Dept A' },
      ];

      User.findAll = jest.fn().mockResolvedValue(mockWorkers);
      WorkOrder.count = jest.fn().mockResolvedValue(2);

      const result = await assignWorkOrder(1, 1);

      expect(result).toEqual(mockWorkers[0]);
      expect(WorkOrder.count).toHaveBeenCalledTimes(1);
    });

    it('should handle database query failure gracefully', async () => {
      User.findAll = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      await expect(assignWorkOrder(1, 1)).rejects.toThrow('Database connection failed');
    });

    it('should handle WorkOrder.count failure gracefully', async () => {
      const mockWorkers = [
        { id: 1, name: 'Worker 1', contact_phone: '111', department: 'Dept A' },
      ];

      User.findAll = jest.fn().mockResolvedValue(mockWorkers);
      WorkOrder.count = jest.fn().mockRejectedValue(new Error('Count query failed'));

      await expect(assignWorkOrder(1, 1)).rejects.toThrow('Count query failed');
    });
  });
});
