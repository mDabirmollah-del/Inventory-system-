import { getAccessToken } from './authService';

/**
 * Google Docs API Services
 */
export const createGoogleDoc = async (title: string): Promise<any> => {
  const token = await getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');

  const response = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to create Google Doc');
  }

  return response.json();
};

export const listGoogleDocs = async (): Promise<any[]> => {
  const token = await getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');

  // We use Drive API to list files with specific mimeType for Docs
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.document'&pageSize=10&fields=files(id,name,webViewLink,iconLink,modifiedTime)`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to list Google Docs');
  }

  const data = await response.json();
  return data.files || [];
};

/**
 * Google Forms API Services
 */
export const createGoogleForm = async (title: string): Promise<any> => {
  const token = await getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');

  // Step 1: Create the form
  const response = await fetch('https://forms.googleapis.com/v1/forms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ info: { title } }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to create Google Form');
  }

  return response.json();
};

export const listGoogleForms = async (): Promise<any[]> => {
  const token = await getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');

  // Use Drive API to list files with specific mimeType for Forms
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.form'&pageSize=10&fields=files(id,name,webViewLink,iconLink,modifiedTime)`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to list Google Forms');
  }

  const data = await response.json();
  return data.files || [];
};

export const getFormResponses = async (formId: string): Promise<any[]> => {
  const token = await getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');

  const response = await fetch(`https://forms.googleapis.com/v1/forms/${formId}/responses`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to get Form responses');
  }

  const data = await response.json();
  return data.responses || [];
};
