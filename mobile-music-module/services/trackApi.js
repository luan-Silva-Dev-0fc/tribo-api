import { api, request } from "../api";
import { Platform } from "react-native";

export const trackApi = {
  async listMyTracks(query = "") {
    if (api.tracks?.list) {
      const res = await api.tracks.list(query);
      return res?.tracks || [];
    }
    const res = await request(`/users/me/tracks${query ? `?query=${encodeURIComponent(query)}` : ""}`);
    return res?.tracks || [];
  },

  async uploadTrack({ uri, name, type, title, artist, duration }) {
    if (api.tracks?.upload) {
      const res = await api.tracks.upload({ uri, name, type, title, artist, duration });
      return res?.track || res;
    }
    const form = new FormData();
    const cleanUri =
      Platform.OS === "ios" && typeof uri === "string" && uri.startsWith("file://")
        ? uri.replace("file://", "")
        : uri;

    form.append("file", {
      uri: cleanUri,
      name: name || "audio.mp3",
      type: type || "audio/mpeg"
    });
    if (title) form.append("title", title);
    if (artist) form.append("artist", artist);
    if (duration) form.append("duration", String(duration));

    const res = await request("/users/me/tracks", {
      method: "POST",
      body: form
    });
    return res?.track || res;
  },

  async deleteTrack(trackId) {
    if (api.tracks?.remove) {
      return await api.tracks.remove(trackId);
    }
    return await request(`/users/me/tracks/${trackId}`, { method: "DELETE" });
  },

  async getGroupQueue(groupId) {
    if (api.tracks?.getGroupQueue) {
      return await api.tracks.getGroupQueue(groupId);
    }
    return await request(`/groups/${groupId}/queue`);
  }
};
