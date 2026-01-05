/**
 * Solibri REST API Client
 *
 * For when Solibri is running with --rest-api-server-port
 */

const config = require('../config');

const BASE_URL = config.SOLIBRI.restApiUrl;

/**
 * Make request to Solibri REST API
 */
async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Solibri API error: ${response.status} - ${text}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    return await response.text();
  } catch (error) {
    if (error.cause?.code === 'ECONNREFUSED') {
      throw new Error('Solibri is not running or REST API is not enabled. Start Solibri with --rest-api-server-port flag.');
    }
    throw error;
  }
}

/**
 * Check if Solibri REST API is available
 */
async function ping() {
  return await request('/ping');
}

/**
 * Get Solibri version and product info
 */
async function about() {
  return await request('/about');
}

/**
 * Get current status (busy, filename, saved state)
 */
async function status() {
  return await request('/status');
}

/**
 * Submit a new IFC model
 */
async function submitModel(ifcContent, filename) {
  return await request('/models', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Filename': filename,
    },
    body: ifcContent,
  });
}

/**
 * Update model with partial IFC
 */
async function partialUpdate(modelUUID, ifcContent) {
  return await request(`/models/${modelUUID}/partialUpdate`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    body: ifcContent,
  });
}

/**
 * Delete components from model
 */
async function deleteComponents(modelUUID, ifcGuids) {
  return await request(`/models/${modelUUID}/deleteComponents`, {
    method: 'POST',
    body: JSON.stringify({ guids: ifcGuids }),
  });
}

/**
 * Get selection basket
 */
async function getSelectionBasket() {
  return await request('/selectionBasket');
}

/**
 * Set selection basket
 */
async function setSelectionBasket(guids) {
  return await request('/selectionBasket', {
    method: 'POST',
    body: JSON.stringify({ guids }),
  });
}

/**
 * Highlight and get info for a component
 */
async function getComponentInfo(guid) {
  return await request(`/info/${guid}`, {
    method: 'POST',
  });
}

/**
 * Get BCF export
 */
async function getBcf(version = '2.1') {
  return await request(`/bcfxml/${version}`);
}

/**
 * Check if Solibri is currently busy
 */
async function isBusy() {
  const s = await status();
  return s.busy === true;
}

/**
 * Wait for Solibri to become idle
 */
async function waitUntilIdle(timeoutMs = 60000, pollIntervalMs = 1000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const busy = await isBusy();
    if (!busy) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Solibri did not become idle within ${timeoutMs}ms`);
}

module.exports = {
  ping,
  about,
  status,
  submitModel,
  partialUpdate,
  deleteComponents,
  getSelectionBasket,
  setSelectionBasket,
  getComponentInfo,
  getBcf,
  isBusy,
  waitUntilIdle,
};
