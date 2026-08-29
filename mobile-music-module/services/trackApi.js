import axios from 'axios';

// Altere para a URL base da sua API se necessário (ex: URL do Railway ou IP local)
const API_BASE_URL = 'http://localhost:3000/api';

export const trackApi = {
  /**
   * Lista e pesquisa músicas na galeria do usuário
   */
  async listMyTracks(query = '', token) {
    const response = await axios.get(`${API_BASE_URL}/users/me/tracks`, {
      params: { query },
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data.tracks || [];
  },

  /**
   * Upload de arquivo de áudio (.mp3, .m4a)
   */
  async uploadTrack({ uri, name, type, title, artist, duration }, token) {
    const formData = new FormData();
    formData.append('file', {
      uri,
      name: name || 'audio.mp3',
      type: type || 'audio/mpeg'
    });

    formData.append('title', title);
    formData.append('artist', artist || 'Desconhecido');
    if (duration) {
      formData.append('duration', String(duration));
    }

    const response = await axios.post(`${API_BASE_URL}/users/me/tracks`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data.track;
  },

  /**
   * Exclui música da galeria
   */
  async deleteTrack(trackId, token) {
    await axios.delete(`${API_BASE_URL}/users/me/tracks/${trackId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  /**
   * Consulta a fila atual do grupo
   */
  async getGroupQueue(groupId, token) {
    const response = await axios.get(`${API_BASE_URL}/groups/${groupId}/queue`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  }
};
