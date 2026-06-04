/**
 * Applied to the slow Jest project only. Reduces axios-retry attempts so spawn
 * integration tests finish in seconds instead of minutes. Not used in production.
 */
process.env.ADAAS_TEST_HTTP_RETRIES = '2';
