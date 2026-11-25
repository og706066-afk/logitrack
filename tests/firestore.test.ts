import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  initializeTestEnvironment, 
  RulesTestEnvironment 
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';

let testEnv: RulesTestEnvironment;

describe('SILOG Final Patch 3 Security Tests', () => {
  beforeEach(async () => {
    const rulesPath = path.resolve(__dirname, '../firestore.rules');
    const rulesContent = fs.readFileSync(rulesPath, 'utf8');

    testEnv = await initializeTestEnvironment({
      projectId: 'silog-test-project',
      firestore: {
        rules: rulesContent,
        host: 'localhost',
        port: 8080,
      },
    });
  });

  afterEach(async () => {
    if (testEnv) await testEnv.cleanup();
  });

  // ==========================================
  // USERS COLLECTION TESTS
  // ==========================================

  it('1. Viewer trying to add permissions on own profile -> DENY', async () => {
    const ctx = testEnv.authenticatedContext('viewer-1', { email: 'viewer@silog.pesantren.id' });
    const db = ctx.firestore();

    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await admin.firestore().doc('users/viewer-1').set({
        uid: 'viewer-1',
        email: 'viewer@silog.pesantren.id',
        role: 'Viewer',
        isActive: true,
        permissions: ['dashboard.view']
      });
    });

    await expect(
      db.doc('users/viewer-1').update({ permissions: ['dashboard.view', 'products.delete'] })
    ).rejects.toThrow();
  });

  it('2. Viewer trying to change permissions to products.delete -> DENY', async () => {
    const ctx = testEnv.authenticatedContext('viewer-1', { email: 'viewer@silog.pesantren.id' });
    const db = ctx.firestore();

    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await admin.firestore().doc('users/viewer-1').set({
        uid: 'viewer-1',
        email: 'viewer@silog.pesantren.id',
        role: 'Viewer',
        isActive: true,
        permissions: []
      });
    });

    await expect(
      db.doc('users/viewer-1').update({ permissions: ['products.delete'] })
    ).rejects.toThrow();
  });

  it('3. New user trying to register with permissions field -> DENY', async () => {
    const ctx = testEnv.authenticatedContext('new-user', { email: 'new@silog.pesantren.id' });
    const db = ctx.firestore();

    await expect(
      db.doc('users/new-user').set({
        uid: 'new-user',
        email: 'new@silog.pesantren.id',
        displayName: 'New User',
        role: 'Viewer',
        isActive: true,
        permissions: ['products.delete'],
        createdAt: new Date(),
        updatedAt: new Date()
      })
    ).rejects.toThrow();
  });

  it('4. New user trying to register with role other than Viewer -> DENY', async () => {
    const ctx = testEnv.authenticatedContext('new-admin', { email: 'fakeadmin@silog.pesantren.id' });
    const db = ctx.firestore();

    await expect(
      db.doc('users/new-admin').set({
        uid: 'new-admin',
        email: 'fakeadmin@silog.pesantren.id',
        displayName: 'Fake Admin',
        role: 'Super Admin',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    ).rejects.toThrow();
  });

  it('5. New user registration with uid != auth.uid -> DENY', async () => {
    const ctx = testEnv.authenticatedContext('auth-uid', { email: 'auth@silog.pesantren.id' });
    const db = ctx.firestore();

    await expect(
      db.doc('users/different-uid').set({
        uid: 'different-uid',
        email: 'auth@silog.pesantren.id',
        displayName: 'Test User',
        role: 'Viewer',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    ).rejects.toThrow();
  });

  it('6. New user registration without permissions field -> ALLOW', async () => {
    const ctx = testEnv.authenticatedContext('new-uid', { email: 'new@silog.pesantren.id' });
    const db = ctx.firestore();

    await expect(
      db.doc('users/new-uid').set({
        uid: 'new-uid',
        name: 'New User',
        email: 'new@silog.pesantren.id',
        displayName: 'New User',
        role: 'Viewer',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    ).resolves.toBeDefined();
  });

  it('6a. New user registration with name field -> ALLOW', async () => {
    const ctx = testEnv.authenticatedContext('new-named-user', { email: 'named@silog.pesantren.id' });
    const db = ctx.firestore();

    await expect(
      db.doc('users/new-named-user').set({
        uid: 'new-named-user',
        name: 'Named User',
        email: 'named@silog.pesantren.id',
        displayName: 'Named User',
        role: 'Viewer',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    ).resolves.toBeDefined();
  });

  it('6b. User cannot change own role -> DENY', async () => {
    const ctx = testEnv.authenticatedContext('self-role-user', { email: 'self@silog.pesantren.id' });
    const db = ctx.firestore();

    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await admin.firestore().doc('users/self-role-user').set({
        uid: 'self-role-user',
        name: 'Self User',
        email: 'self@silog.pesantren.id',
        displayName: 'Self User',
        role: 'Viewer',
        isActive: true,
        permissions: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    await expect(
      db.doc('users/self-role-user').update({ role: 'Super Admin' })
    ).rejects.toThrow();
  });

  it('6c. User can update own name -> ALLOW', async () => {
    const ctx = testEnv.authenticatedContext('self-name-user', { email: 'selfname@silog.pesantren.id' });
    const db = ctx.firestore();

    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await admin.firestore().doc('users/self-name-user').set({
        uid: 'self-name-user',
        name: 'Self Name',
        email: 'selfname@silog.pesantren.id',
        displayName: 'Self Name',
        role: 'Viewer',
        isActive: true,
        permissions: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    await expect(
      db.doc('users/self-name-user').update({ name: 'Nama Baru', updatedAt: new Date() })
    ).resolves.toBeDefined();
  });

  it('6d. Super Admin can change another user role -> ALLOW', async () => {
    const ctx = testEnv.authenticatedContext('admin-role', { email: 'adminrole@silog.pesantren.id' });
    const db = ctx.firestore();

    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await admin.firestore().doc('users/admin-role').set({
        uid: 'admin-role',
        name: 'Admin Role',
        email: 'adminrole@silog.pesantren.id',
        displayName: 'Admin Role',
        role: 'Super Admin',
        isActive: true,
        permissions: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await admin.firestore().doc('users/target-role').set({
        uid: 'target-role',
        name: 'Target User',
        email: 'targetrole@silog.pesantren.id',
        displayName: 'Target User',
        role: 'Viewer',
        isActive: true,
        permissions: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    await expect(
      db.doc('users/target-role').update({ role: 'Kepala Gudang' })
    ).resolves.toBeDefined();
  });

  it('6e. Legacy auth user without profile can read own missing profile -> ALLOW', async () => {
    const ctx = testEnv.authenticatedContext('legacy-user', { email: 'legacy@silog.pesantren.id' });
    const db = ctx.firestore();

    const snapshot = await db.doc('users/legacy-user').get();
    expect(snapshot.exists).toBe(false);
  });

  it('7. Inactive user trying to read roles -> DENY', async () => {
    const ctx = testEnv.authenticatedContext('inactive-user', { email: 'dead@silog.pesantren.id' });
    const db = ctx.firestore();

    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await admin.firestore().doc('users/inactive-user').set({
        uid: 'inactive-user',
        email: 'dead@silog.pesantren.id',
        role: 'Manager',
        isActive: false,
        permissions: []
      });
      await admin.firestore().doc('roles/role-test').set({
        name: 'Test Role',
        permissions: ['products.view']
      });
    });

    await expect(
      db.collection('roles').get()
    ).rejects.toThrow();
  });

  it('8. Inactive user trying to read permissions -> DENY', async () => {
    const ctx = testEnv.authenticatedContext('inactive-user', { email: 'dead@silog.pesantren.id' });
    const db = ctx.firestore();

    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await admin.firestore().doc('users/inactive-user').set({
        uid: 'inactive-user',
        email: 'dead@silog.pesantren.id',
        role: 'Manager',
        isActive: false,
        permissions: []
      });
      await admin.firestore().doc('permissions/perm-test').set({
        id: 'products.view',
        module: 'Products',
        action: 'view',
        name: 'View Products',
        description: 'View products'
      });
    });

    await expect(
      db.collection('permissions').get()
    ).rejects.toThrow();
  });

  it('9. Super Admin updating user permissions -> ALLOW', async () => {
    const ctx = testEnv.authenticatedContext('admin-1', { email: 'admin@silog.pesantren.id' });
    const db = ctx.firestore();

    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await admin.firestore().doc('users/admin-1').set({
        uid: 'admin-1',
        email: 'admin@silog.pesantren.id',
        role: 'Super Admin',
        isActive: true,
        permissions: []
      });
      await admin.firestore().doc('users/target-user').set({
        uid: 'target-user',
        email: 'target@silog.pesantren.id',
        role: 'Viewer',
        isActive: true,
        permissions: []
      });
    });

    await expect(
      db.doc('users/target-user').update({ permissions: ['products.view'] })
    ).resolves.toBeDefined();
  });

  // ==========================================
  // REQUESTS COLLECTION TESTS
  // ==========================================

  it('10. Viewer trying to access unauthorized operations (create product) -> DENY', async () => {
    const ctx = testEnv.authenticatedContext('viewer-2', { email: 'viewer2@silog.pesantren.id' });
    const db = ctx.firestore();

    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await admin.firestore().doc('users/viewer-2').set({
        uid: 'viewer-2',
        email: 'viewer2@silog.pesantren.id',
        role: 'Viewer',
        isActive: true,
        permissions: ['dashboard.view']
      });
    });

    await expect(
      db.collection('products').add({ name: 'Illegal Product' })
    ).rejects.toThrow();
  });

  it('11. Manager trying to modify master data without permission -> DENY', async () => {
    const ctx = testEnv.authenticatedContext('manager-1', { email: 'manager@silog.pesantren.id' });
    const db = ctx.firestore();

    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await admin.firestore().doc('users/manager-1').set({
        uid: 'manager-1',
        email: 'manager@silog.pesantren.id',
        role: 'Manager',
        isActive: true,
        permissions: ['dashboard.view', 'requests.approve']
      });
    });

    await expect(
      db.collection('products').add({ name: 'Manager Product' })
    ).rejects.toThrow();
  });

  it('12. Staf Gudang trying to approve requests -> DENY', async () => {
    const ctx = testEnv.authenticatedContext('gudang-1', { email: 'gudang@silog.pesantren.id' });
    const db = ctx.firestore();

    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await admin.firestore().doc('users/gudang-1').set({
        uid: 'gudang-1',
        email: 'gudang@silog.pesantren.id',
        role: 'Staf Gudang',
        isActive: true,
        permissions: ['stock_in.create', 'products.view']
      });
      await admin.firestore().doc('requests/req-1').set({
        id: 'req-1',
        status: 'Pending'
      });
    });

    await expect(
      db.doc('requests/req-1').update({ status: 'Approved' })
    ).rejects.toThrow();
  });

  it('13. User with requests.approve trying to change non-approval fields -> DENY', async () => {
    const ctx = testEnv.authenticatedContext('approver-1', { email: 'approver@silog.pesantren.id' });
    const db = ctx.firestore();

    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await admin.firestore().doc('users/approver-1').set({
        uid: 'approver-1',
        email: 'approver@silog.pesantren.id',
        role: 'Viewer',
        isActive: true,
        permissions: ['requests.approve']
      });
      await admin.firestore().doc('requests/req-1').set({
        id: 'req-1',
        status: 'Pending',
        requestNumber: 'REQ-001',
        requesterName: 'Test User'
      });
    });

    await expect(
      db.doc('requests/req-1').update({ requesterName: 'Hacked Name' })
    ).rejects.toThrow();
  });

  it('14. User with requests.approve updating only approval fields -> ALLOW', async () => {
    const ctx = testEnv.authenticatedContext('approver-1', { email: 'approver@silog.pesantren.id' });
    const db = ctx.firestore();

    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await admin.firestore().doc('users/approver-1').set({
        uid: 'approver-1',
        email: 'approver@silog.pesantren.id',
        role: 'Viewer',
        isActive: true,
        permissions: ['requests.approve']
      });
      await admin.firestore().doc('requests/req-1').set({
        id: 'req-1',
        status: 'Pending',
        requestNumber: 'REQ-001',
        requesterName: 'Test User'
      });
    });

    await expect(
      db.doc('requests/req-1').update({ status: 'Approved', approvedBy: 'approver-1' })
    ).resolves.toBeDefined();
  });

  // ==========================================
  // REQUEST DETAILS TESTS
  // ==========================================

  it('15. Request details with manipulated requestId -> DENY', async () => {
    const ctx = testEnv.authenticatedContext('user-1', { email: 'user@silog.pesantren.id' });
    const db = ctx.firestore();

    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await admin.firestore().doc('users/user-1').set({
        uid: 'user-1',
        email: 'user@silog.pesantren.id',
        role: 'Viewer',
        isActive: true,
        permissions: ['requests.create']
      });
      await admin.firestore().doc('requests/req-1').set({
        id: 'req-1',
        status: 'Pending'
      });
    });

    await expect(
      db.collection('request_details').add({
        id: 'det-1',
        requestId: 'req-999', // non-existent request
        productId: 'prod-1',
        productName: 'Beras',
        requestedQty: 10,
        unit: 'kg'
      })
    ).rejects.toThrow();
  });

  it('16. Request details with valid requestId -> ALLOW', async () => {
    const ctx = testEnv.authenticatedContext('user-1', { email: 'user@silog.pesantren.id' });
    const db = ctx.firestore();

    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await admin.firestore().doc('users/user-1').set({
        uid: 'user-1',
        email: 'user@silog.pesantren.id',
        role: 'Viewer',
        isActive: true,
        permissions: ['requests.create']
      });
      await admin.firestore().doc('requests/req-1').set({
        id: 'req-1',
        status: 'Pending'
      });
    });

    await expect(
      db.collection('request_details').add({
        id: 'det-1',
        requestId: 'req-1',
        productId: 'prod-1',
        productName: 'Beras',
        requestedQty: 10,
        unit: 'kg'
      })
    ).resolves.toBeDefined();
  });

  // ==========================================
  // DRIVER ISOLATION TESTS
  // ==========================================

  it('17. Driver reading delivery belonging to another driver -> DENY', async () => {
    const ctx = testEnv.authenticatedContext('driver-A', { email: 'driverA@silog.pesantren.id' });
    const db = ctx.firestore();

    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await admin.firestore().doc('users/driver-A').set({
        uid: 'driver-A',
        email: 'driverA@silog.pesantren.id',
        role: 'Driver',
        isActive: true,
        permissions: ['deliveries.view']
      });
      await admin.firestore().doc('deliveries/del-100').set({
        id: 'del-100',
        driverId: 'driver-B'
      });
    });

    await expect(
      db.doc('deliveries/del-100').get()
    ).rejects.toThrow();
  });

  it('18. Driver reading delivery_details belonging to another driver -> DENY', async () => {
    const ctx = testEnv.authenticatedContext('driver-A', { email: 'driverA@silog.pesantren.id' });
    const db = ctx.firestore();

    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await admin.firestore().doc('users/driver-A').set({
        uid: 'driver-A',
        email: 'driverA@silog.pesantren.id',
        role: 'Driver',
        isActive: true,
        permissions: ['deliveries.view']
      });
      await admin.firestore().doc('deliveries/del-100').set({
        id: 'del-100',
        driverId: 'driver-B'
      });
      await admin.firestore().doc('delivery_details/det-100').set({
        id: 'det-100',
        deliveryId: 'del-100'
      });
    });

    await expect(
      db.doc('delivery_details/det-100').get()
    ).rejects.toThrow();
  });

  it('19. Driver reading own delivery_details -> ALLOW', async () => {
    const ctx = testEnv.authenticatedContext('driver-A', { email: 'driverA@silog.pesantren.id' });
    const db = ctx.firestore();

    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await admin.firestore().doc('users/driver-A').set({
        uid: 'driver-A',
        email: 'driverA@silog.pesantren.id',
        role: 'Driver',
        isActive: true,
        permissions: ['deliveries.view']
      });
      await admin.firestore().doc('deliveries/del-100').set({
        id: 'del-100',
        driverId: 'driver-A'
      });
      await admin.firestore().doc('delivery_details/det-100').set({
        id: 'det-100',
        deliveryId: 'del-100'
      });
    });

    await expect(
      db.doc('delivery_details/det-100').get()
    ).resolves.toBeDefined();
  });

  // ==========================================
  // DYNAMIC RBAC TESTS
  // ==========================================

  it('20. Staf Gudang without warehouses.create permission cannot create warehouse -> DENY', async () => {
    const ctx = testEnv.authenticatedContext('gudang-2', { email: 'gudang2@silog.pesantren.id' });
    const db = ctx.firestore();

    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await admin.firestore().doc('users/gudang-2').set({
        uid: 'gudang-2',
        email: 'gudang2@silog.pesantren.id',
        role: 'Staf Gudang',
        isActive: true,
        permissions: ['products.view'] // no warehouses.create
      });
    });

    await expect(
      db.collection('warehouses').add({ name: 'Gudang Baru' })
    ).rejects.toThrow();
  });

  it('21. User with warehouses.create permission can create warehouse -> ALLOW', async () => {
    const ctx = testEnv.authenticatedContext('gudang-3', { email: 'gudang3@silog.pesantren.id' });
    const db = ctx.firestore();

    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await admin.firestore().doc('users/gudang-3').set({
        uid: 'gudang-3',
        email: 'gudang3@silog.pesantren.id',
        role: 'Staf Gudang',
        isActive: true,
        permissions: ['warehouses.create']
      });
    });

    await expect(
      db.collection('warehouses').add({ name: 'Gudang Baru' })
    ).resolves.toBeDefined();
  });

  // ==========================================
  // SUPER ADMIN TESTS
  // ==========================================

  it('22. Super Admin managing permissions -> ALLOW', async () => {
    const ctx = testEnv.authenticatedContext('admin-1', { email: 'admin@silog.pesantren.id' });
    const db = ctx.firestore();

    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await admin.firestore().doc('users/admin-1').set({
        uid: 'admin-1',
        email: 'admin@silog.pesantren.id',
        role: 'Super Admin',
        isActive: true,
        permissions: []
      });
    });

    await expect(
      db.collection('permissions').doc('products.view').set({
        id: 'products.view',
        module: 'Products',
        action: 'view',
        name: 'View Products',
        description: 'View products'
      })
    ).resolves.toBeDefined();
  });

  // ==========================================
  // AUDIT LOGS TESTS
  // ==========================================

  it('23. User trying to create audit log with fake userId -> DENY', async () => {
    const ctx = testEnv.authenticatedContext('user-1', { email: 'user@silog.pesantren.id' });
    const db = ctx.firestore();

    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await admin.firestore().doc('users/user-1').set({
        uid: 'user-1',
        email: 'user@silog.pesantren.id',
        role: 'Viewer',
        isActive: true,
        permissions: []
      });
    });

    await expect(
      db.collection('audit_logs').add({
        id: 'log-1',
        userId: 'other-user', // fake userId
        userName: 'Fake User',
        action: 'TEST_ACTION',
        module: 'Test',
        description: 'Test log',
        createdAt: new Date()
      })
    ).rejects.toThrow();
  });
});
