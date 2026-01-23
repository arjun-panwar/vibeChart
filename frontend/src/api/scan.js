import client from './client';

export const scanPath = async (path) => {
    const response = await client.post('/scan', { path });
    return response.data;
};
