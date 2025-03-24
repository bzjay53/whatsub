/**
 * Test script for Airtable API wrapper
 * Open this file in the browser to test the Airtable API functions
 */

import {
  getAllUsers,
  getUserByEmail,
  createUser,
  updateUser,
  updateLastLogin,
  upsertUser
} from '../lib/airtable-api.js';

// Container for test results
const resultsContainer = document.createElement('div');
resultsContainer.id = 'results';
document.body.appendChild(resultsContainer);

// Helper function to log results
function logResult(title, data) {
  const resultDiv = document.createElement('div');
  resultDiv.innerHTML = `
    <h3>${title}</h3>
    <pre>${JSON.stringify(data, null, 2)}</pre>
    <hr>
  `;
  resultsContainer.appendChild(resultDiv);
  console.log(title, data);
}

// Helper function to log errors
function logError(title, error) {
  const errorDiv = document.createElement('div');
  errorDiv.style.color = 'red';
  errorDiv.innerHTML = `
    <h3>${title} - ERROR</h3>
    <pre>${error.message}</pre>
    <hr>
  `;
  resultsContainer.appendChild(errorDiv);
  console.error(title, error);
}

// Run tests
async function runTests() {
  try {
    // Test 1: Get all users
    try {
      const users = await getAllUsers();
      logResult('Get All Users', users);
    } catch (error) {
      logError('Get All Users', error);
    }

    // Test 2: Get user by email
    try {
      const user = await getUserByEmail('test@example.com');
      logResult('Get User by Email (test@example.com)', user);
    } catch (error) {
      logError('Get User by Email', error);
    }

    // Test 3: Create a new test user
    try {
      const newUser = {
        Name: `Test User ${new Date().toISOString()}`,
        Email: `test_${Date.now()}@example.com`,
        Notes: 'Created by test script',
        Status: 'Todo',
        "Created At": new Date().toISOString().split('T')[0],
        "Subscription Type": "Free"
      };
      
      const createdUser = await createUser(newUser);
      logResult('Create New User', createdUser);
      
      // Store user ID for subsequent tests
      window.testUserId = createdUser.id;
    } catch (error) {
      logError('Create New User', error);
    }

    // Test 4: Update the user we just created
    if (window.testUserId) {
      try {
        const updatedUser = await updateUser(window.testUserId, {
          Notes: 'Updated by test script',
          "Subscription Type": "Basic"
        });
        logResult('Update User', updatedUser);
      } catch (error) {
        logError('Update User', error);
      }
    }

    // Test 5: Update last login time
    if (window.testUserId) {
      try {
        const updatedLogin = await updateLastLogin(window.testUserId);
        logResult('Update Last Login', updatedLogin);
      } catch (error) {
        logError('Update Last Login', error);
      }
    }

    // Test 6: Upsert a user (create)
    try {
      const upsertNewUser = {
        Name: `Upsert Test User ${new Date().toISOString()}`,
        Email: `upsert_${Date.now()}@example.com`,
        Notes: 'Created by upsert',
        Status: 'Todo',
        "Created At": new Date().toISOString().split('T')[0],
        "Subscription Type": "Free"
      };
      
      const upsertedUser = await upsertUser(upsertNewUser);
      logResult('Upsert User (Create)', upsertedUser);
    } catch (error) {
      logError('Upsert User (Create)', error);
    }

    // Test 7: Upsert a user (update) - using the same email
    if (window.testUserId) {
      try {
        const userToUpdate = await getUserByEmail(`test_${Date.now()}@example.com`);
        if (userToUpdate) {
          const upsertUpdateUser = {
            Email: userToUpdate.fields.Email,
            Notes: 'Updated by upsert',
            "Subscription Type": "Premium"
          };
          
          const updatedUser = await upsertUser(upsertUpdateUser);
          logResult('Upsert User (Update)', updatedUser);
        }
      } catch (error) {
        logError('Upsert User (Update)', error);
      }
    }

  } catch (error) {
    logError('General Test Error', error);
  }
}

// Create page structure
document.body.innerHTML = `
  <h1>Airtable API Test</h1>
  <button id="runTests">Run All Tests</button>
  <div id="results"></div>
`;

// Add event listener to button
document.getElementById('runTests').addEventListener('click', runTests);

// Style for better readability
const style = document.createElement('style');
style.textContent = `
  body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
  pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow: auto; }
  button { padding: 10px 20px; font-size: 16px; cursor: pointer; background: #4CAF50; color: white; border: none; border-radius: 4px; }
  button:hover { background: #45a049; }
  hr { border: 0; height: 1px; background: #ddd; margin: 20px 0; }
`;
document.head.appendChild(style); 