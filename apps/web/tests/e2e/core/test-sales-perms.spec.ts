import { test } from './fixtures/rbac.fixture';

test('print sales permissions', async ({ sales }) => {
  console.log("Sales Permissions:", sales.permissions);
});
