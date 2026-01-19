import axios from 'axios';

const API_Base = 'http://localhost:8000';

export const scanPath = async (path) => {
  try {
    const response = await axios.post(`${API_Base}/scan`, { path });
    return response.data;
  } catch (error) {
    console.error("Error scanning path:", error);
    throw error;
  }
};

export const reanalyzePath = async (path) => {
  try {
    const response = await axios.post(`${API_Base}/reanalyze`, { path });
    return response.data;
  } catch (error) {
    console.error("Error reanalyzing path:", error);
    throw error;
  }
};
