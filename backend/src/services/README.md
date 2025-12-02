# Backend Services for User Story 1: Work Order Submission and Assignment

This directory contains the core business logic services for the Work Order Management System.

## Services Overview

### 1. assignmentService.js (T057)
**Purpose:** Intelligent work order assignment to maintenance workers

**Key Functions:**
- `assignWorkOrder(workOrderId, faultTypeId)` - Assigns work order using round-robin algorithm
- `getTechnicianWorkloadStats()` - Returns workload statistics for all technicians
- `checkTechnicianCapacity(technicianId)` - Checks if a technician can accept more orders

**Algorithm:**
1. Queries all active maintenance workers (role_id = 5, active = true)
2. Counts active work orders ("In Progress") for each technician
3. Filters technicians with available capacity (< 5 concurrent orders)
4. Selects technician with least active work orders
5. Returns assigned technician user object

**Example Usage:**
```javascript
const { assignWorkOrder } = require('./services/assignmentService');

try {
  const assignedTechnician = await assignWorkOrder(workOrderId, faultTypeId);
  console.log(`Assigned to: ${assignedTechnician.name}`);
} catch (error) {
  console.error('Assignment failed:', error.message);
}
```

### 2. notificationService.js (T058)
**Purpose:** WeChat template message notifications with retry logic

**Key Functions:**
- `sendWorkOrderNotification(workOrder, recipientIds, eventType, additionalData)` - Send notifications
- `retryFailedNotifications(limit)` - Retry failed notifications (for cron job)
- `getWorkOrderNotificationStats(workOrderId)` - Get notification statistics

**Supported Event Types:**
- `work_order_created` - New work order assigned
- `status_changed` - Status update notification
- `sla_warning` - SLA deadline approaching
- `escalation` - Work order escalated

**Features:**
- Automatic retry with exponential backoff (1s, 2s, 4s)
- Maximum 3 retry attempts
- Database tracking of all notifications
- Batch notification support

**Example Usage:**
```javascript
const { sendWorkOrderNotification } = require('./services/notificationService');

// Notify technician of new assignment
const result = await sendWorkOrderNotification(
  workOrder,
  [technicianId],
  'work_order_created',
  { faultTypeName: '水管漏水' }
);

console.log(`Sent: ${result.success}, Failed: ${result.failed}`);
```

### 3. photoUpload.js (T059)
**Purpose:** Photo upload utility for Tencent Cloud Object Storage (COS)

**Key Functions:**
- `generatePresignedUrl(fileType, userId, fileSizeBytes)` - Generate pre-signed upload URL
- `validatePhotoUrl(url)` - Validate URL is from COS domain
- `deletePhoto(url)` - Delete single photo
- `deletePhotos(urls)` - Batch delete photos
- `photoExists(url)` - Check if photo exists
- `getPublicUrl(key)` - Get public URL for a key

**Security:**
- Pre-signed URLs expire after 15 minutes
- Only accepts image types: image/jpeg, image/png, image/webp
- Maximum file size: 5MB
- Validates all URLs are from configured COS bucket

**Example Usage:**
```javascript
const { generatePresignedUrl, validatePhotoUrl } = require('../utils/photoUpload');

// Generate upload URL
const { presignedUrl, key } = await generatePresignedUrl(
  'image/jpeg',
  userId,
  1024000 // 1MB
);

// Client uploads to presignedUrl
// Then store the public URL
const publicUrl = getPublicUrl(key);

// Validate URL before saving
if (validatePhotoUrl(publicUrl)) {
  // Save to work order photos_json
}
```

## Configuration

### Environment Variables Required

Add these to your `.env` file:

```env
# WeChat Template IDs
WECHAT_TEMPLATE_CREATED=template_id_for_created
WECHAT_TEMPLATE_STATUS=template_id_for_status
WECHAT_TEMPLATE_SLA=template_id_for_sla
WECHAT_TEMPLATE_ESCALATION=template_id_for_escalation

# Tencent Cloud COS
COS_SECRET_ID=your_secret_id
COS_SECRET_KEY=your_secret_key
COS_BUCKET=your-bucket-name
COS_REGION=ap-guangzhou
```

### Installation

Install required dependencies:

```bash
npm install cos-nodejs-sdk-v5
```

## Error Handling

All services implement comprehensive error handling:

- **assignmentService**: Throws error if no available technicians
- **notificationService**: Retries failed notifications up to 3 times
- **photoUpload**: Validates file types and sizes before processing

Always wrap service calls in try-catch blocks:

```javascript
try {
  await serviceFunction();
} catch (error) {
  logger.error('Service call failed', { error: error.message });
  // Handle error appropriately
}
```

## Logging

All services use the centralized Winston logger:

- Info level: Successful operations
- Warn level: Retries, capacity issues
- Error level: Failures with stack traces
- Debug level: Detailed operation data

Check logs at: `backend/logs/`

## Testing

Unit tests should be added in `backend/tests/unit/services/`:

- `assignmentService.test.js`
- `notificationService.test.js`
- `photoUpload.test.js`

Integration tests in `backend/tests/integration/services/`

## Common Patterns

### 1. Work Order Assignment Flow
```javascript
// In workOrderController.js
const { assignWorkOrder } = require('../services/assignmentService');
const { sendWorkOrderNotification } = require('../services/notificationService');

const technician = await assignWorkOrder(workOrder.id, workOrder.fault_type_id);
await workOrder.update({
  assigned_technician_id: technician.id,
  assigned_at: new Date()
});

await sendWorkOrderNotification(
  workOrder,
  [technician.id],
  'work_order_created'
);
```

### 2. Photo Upload Flow
```javascript
// Step 1: Client requests pre-signed URL
const { presignedUrl, key } = await generatePresignedUrl('image/jpeg', userId);

// Step 2: Client uploads directly to COS using presignedUrl
// (This happens on the client side)

// Step 3: Client sends the final public URL to save
const publicUrl = getPublicUrl(key);
if (validatePhotoUrl(publicUrl)) {
  await workOrder.update({
    photos_json: [...existingPhotos, publicUrl]
  });
}
```

### 3. Notification Retry (Cron Job)
```javascript
// In cron job
const { retryFailedNotifications } = require('../services/notificationService');

cron.schedule('*/5 * * * *', async () => {
  const result = await retryFailedNotifications(50);
  logger.info('Notification retry job completed', result);
});
```

## Performance Considerations

1. **Assignment Service**: Queries are optimized with indexes on `role_id`, `active`, and `status`
2. **Notification Service**: Batch operations use `Promise.allSettled` for parallel processing
3. **Photo Upload**: Pre-signed URLs eliminate server-side upload processing

## Security Notes

- All services validate inputs before processing
- Photo uploads restricted to images only
- Pre-signed URLs expire automatically
- WeChat openids are redacted in logs
- Database transactions used where needed

## Dependencies

- Sequelize ORM for database operations
- Axios for WeChat API calls
- cos-nodejs-sdk-v5 for Tencent Cloud storage
- Winston for logging
- ioredis for caching (via wechat config)

## Troubleshooting

### No Available Technicians
- Check if technicians are active: `SELECT * FROM users WHERE role_id = 5 AND active = true`
- Check workload: Use `getTechnicianWorkloadStats()`
- Increase MAX_CONCURRENT_ORDERS_PER_TECHNICIAN in constants.js

### WeChat Notifications Failing
- Verify template IDs are correct
- Check WeChat credentials in .env
- Ensure users have valid wechat_openid
- Check logs for specific error codes

### Photo Upload Issues
- Verify COS credentials are correct
- Check COS bucket permissions (allow PUT operations)
- Ensure file types are supported
- Check file size limits

## Future Enhancements

- Smart assignment based on fault type expertise
- Priority-based assignment for urgent orders
- Push notifications in addition to template messages
- Image compression before upload
- CDN integration for faster photo delivery
