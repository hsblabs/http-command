import { httpbinClient, httpbinAuthClient } from './client.js';
import {
  getRequest,
  getHeaders,
  getUuid,
  postJson,
  postForm,
  putJson,
  patchJson,
  deleteRequest,
  delayRequest,
  statusRequest,
  bearerAuth,
} from './commands.js';

async function main() {
  console.log('=== httpbin Example ===\n');

  // Example 1: Simple GET request
  console.log('1. Simple GET request...');
  const getResponse = await httpbinClient.send(getRequest({ params: { foo: 'bar', baz: 123 } }));
  console.log(`  Origin: ${getResponse.origin}`);
  console.log(`  Query params: ${JSON.stringify(getResponse.args)}`);
  console.log();

  // Example 2: Get headers
  console.log('2. Getting headers...');
  const headersResponse = await httpbinClient.send(getHeaders({}));
  console.log(`  User-Agent: ${headersResponse.headers['User-Agent']}`);
  console.log(`  Accept: ${headersResponse.headers['Accept']}`);
  console.log();

  // Example 3: Generate UUID
  console.log('3. Generating UUID...');
  const uuidResponse = await httpbinClient.send(getUuid({}));
  console.log(`  UUID: ${uuidResponse.uuid}`);
  console.log();

  // Example 4: POST JSON data
  console.log('4. POST JSON data...');
  const postResponse = await httpbinClient.send(
    postJson({
      data: {
        message: 'Hello from http-command!',
        timestamp: new Date().toISOString(),
        nested: { key: 'value' },
      },
    }),
  );
  console.log(`  Received data: ${JSON.stringify(postResponse.json)}`);
  console.log();

  // Example 5: POST form data
  console.log('5. POST form data...');
  const formResponse = await httpbinClient.send(
    postForm({
      formData: {
        username: 'testuser',
        email: 'test@example.com',
      },
    }),
  );
  console.log(`  Form data: ${JSON.stringify(formResponse.form)}`);
  console.log();

  // Example 6: PUT request
  console.log('6. PUT request...');
  const putResponse = await httpbinClient.send(
    putJson({
      data: { action: 'update', id: 42 },
    }),
  );
  console.log(`  PUT response: ${JSON.stringify(putResponse.json)}`);
  console.log();

  // Example 7: PATCH request
  console.log('7. PATCH request...');
  const patchResponse = await httpbinClient.send(
    patchJson({
      data: { status: 'active' },
    }),
  );
  console.log(`  PATCH response: ${JSON.stringify(patchResponse.json)}`);
  console.log();

  // Example 8: DELETE request
  console.log('8. DELETE request...');
  const deleteResponse = await httpbinClient.send(deleteRequest({}));
  console.log(`  DELETE completed: ${deleteResponse.url}`);
  console.log();

  // Example 9: Bearer authentication
  console.log('9. Bearer authentication...');
  const authResponse = await httpbinAuthClient.send(bearerAuth({}));
  console.log(`  Authenticated: ${authResponse.authenticated}`);
  console.log(`  Token: ${authResponse.token}`);
  console.log();

  // Example 10: Delayed request (1 second)
  console.log('10. Delayed request (1 second)...');
  const delayStart = Date.now();
  const delayResponse = await httpbinClient.send(delayRequest({ seconds: 1 }));
  const delayDuration = Date.now() - delayStart;
  console.log(`  Delay completed in ${delayDuration}ms`);
  console.log();

  // Example 11: Testing status codes
  console.log('11. Testing status codes...');
  try {
    await httpbinClient.send(statusRequest({ code: 200 }));
    console.log('  Status 200: OK');
  } catch (error) {
    console.log(`  Unexpected error: ${error}`);
  }

  try {
    await httpbinClient.send(statusRequest({ code: 404 }));
    console.log('  Status 404 did not throw an error (unexpected)');
  } catch (error) {
    console.log('  Status 404: Error caught as expected');
  }
  console.log();

  console.log('✓ All examples completed successfully!');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
