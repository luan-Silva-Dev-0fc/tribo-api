import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as MediaLibrary from "expo-media-library";
import { trackApi } from "../../services/trackApi";

export function UserMusicGalleryScreen({ navigation }) {
  const [tracks, setTracks] = useState([]);
  const [deviceAudios, setDeviceAudios] = useState([]);
  const [activeTab, setActiveTab] = useState("cloud");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [playingTrackId, setPlayingTrackId] = useState(null);
  const [previewSound, setPreviewSound] = useState(null);

  const loadTracks = useCallback(async (query = "") => {
    setLoading(true);
    try {
      const data = await trackApi.listMyTracks(query);
      setTracks(data || []);
    } catch (err) {
      console.warn("Erro ao buscar faixas:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDeviceAudios = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === "granted") {
        const media = await MediaLibrary.getAssetsAsync({ mediaType: "audio", first: 50 });
        if (media && media.assets) {
          setDeviceAudios(media.assets);
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    loadTracks(search);
    loadDeviceAudios();
  }, [search, loadTracks]);

  useEffect(() => {
    return () => {
      if (previewSound) {
        previewSound.unloadAsync().catch(() => {});
      }
    };
  }, [previewSound]);

  const handleTogglePreview = async (track) => {
    if (playingTrackId === track.id) {
      if (previewSound) {
        await previewSound.stopAsync().catch(() => {});
        await previewSound.unloadAsync().catch(() => {});
      }
      setPreviewSound(null);
      setPlayingTrackId(null);
      return;
    }

    if (previewSound) {
      await previewSound.unloadAsync().catch(() => {});
    }

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: track.file_url },
        { shouldPlay: true }
      );
      setPreviewSound(sound);
      setPlayingTrackId(track.id);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingTrackId(null);
        }
      });
    } catch (e) {
      Alert.alert("Erro", "Não foi possível reproduzir o áudio.");
    }
  };

  const handleUploadDeviceAudio = async (asset) => {
    setUploading(true);
    try {
      const titleGuess = (asset.filename || asset.name || "Áudio").replace(/\.[^/.]+$/, "");
      await trackApi.uploadTrack({
        uri: asset.uri,
        name: asset.filename || "audio.mp3",
        type: "audio/mpeg",
        title: titleGuess,
        artist: "Minha Faixa",
        duration: Math.round(asset.duration || 0)
      });

      Alert.alert("Sucesso", `"${titleGuess}" adicionada à sua galeria!`);
      loadTracks(search);
      setActiveTab("cloud");
    } catch (err) {
      Alert.alert("Erro no Upload", err.message || "Falha ao enviar arquivo.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (track) => {
    Alert.alert("Excluir Música", `Deseja remover "${track.title}" da sua galeria?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            await trackApi.deleteTrack(track.id);
            setTracks((prev) => prev.filter((t) => t.id !== track.id));
          } catch (e) {
            Alert.alert("Erro", "Falha ao excluir música.");
          }
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation?.goBack?.()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Galeria de Músicas</Text>
          <TouchableOpacity onPress={loadDeviceAudios}>
            <Ionicons name="refresh" size={22} color="#FFB800" />
          </TouchableOpacity>
        </View>

        {/* Abas */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === "cloud" && styles.tabButtonActive]}
            onPress={() => setActiveTab("cloud")}
          >
            <Text style={[styles.tabButtonText, activeTab === "cloud" && styles.tabButtonTextActive]}>
              Nuvem ({tracks.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === "device" && styles.tabButtonActive]}
            onPress={() => setActiveTab("device")}
          >
            <Text style={[styles.tabButtonText, activeTab === "device" && styles.tabButtonTextActive]}>
              Aparelho ({deviceAudios.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Lista */}
        {activeTab === "cloud" ? (
          loading ? (
            <ActivityIndicator size="large" color="#FFB800" style={{ marginTop: 50 }} />
          ) : (
            <FlatList
              data={tracks}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 90 }}
              renderItem={({ item }) => {
                const isPlayingThis = playingTrackId === item.id;
                return (
                  <View style={styles.trackCard}>
                    <TouchableOpacity
                      style={[styles.playButton, isPlayingThis && styles.playButtonActive]}
                      onPress={() => handleTogglePreview(item)}
                    >
                      <Ionicons
                        name={isPlayingThis ? "stop" : "play"}
                        size={20}
                        color={isPlayingThis ? "#000000" : "#FFB800"}
                      />
                    </TouchableOpacity>

                    <View style={styles.trackInfo}>
                      <Text numberOfLines={1} style={styles.trackTitle}>{item.title}</Text>
                      <Text numberOfLines={1} style={styles.trackArtist}>{item.artist}</Text>
                    </View>

                    <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteBtn}>
                      <Ionicons name="trash-outline" size={20} color="#8E8E93" />
                    </TouchableOpacity>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="musical-notes" size={48} color="#2C2C2E" />
                  <Text style={styles.emptyStateTitle}>Sua galeria na nuvem está vazia</Text>
                  <Text style={styles.emptyStateSubtitle}>
                    Toque na aba "Aparelho" para salvar músicas do seu celular na sua galeria da Tribo!
                  </Text>
                </View>
              }
            />
          )
        ) : (
          <FlatList
            data={deviceAudios}
            keyExtractor={(item) => item.id || item.uri}
            contentContainerStyle={{ paddingBottom: 90 }}
            renderItem={({ item }) => (
              <View style={styles.trackCard}>
                <View style={styles.playButton}>
                  <Ionicons name="musical-note" size={20} color="#FFB800" />
                </View>

                <View style={styles.trackInfo}>
                  <Text numberOfLines={1} style={styles.trackTitle}>
                    {(item.filename || item.name || "Áudio").replace(/\.[^/.]+$/, "")}
                  </Text>
                  <Text numberOfLines={1} style={styles.trackArtist}>
                    {Math.floor((item.duration || 0) / 60)}:{(item.duration || 0) % 60 < 10 ? "0" : ""}{Math.floor((item.duration || 0) % 60)} • Armazenamento Local
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => handleUploadDeviceAudio(item)}
                  style={styles.uploadMiniBtn}
                  disabled={uploading}
                >
                  <Ionicons name="cloud-upload" size={18} color="#000000" />
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#000000" },
  container: { flex: 1, backgroundColor: "#000000", paddingHorizontal: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14 },
  backButton: { padding: 4 },
  headerTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  tabRow: { flexDirection: "row", backgroundColor: "#121212", borderRadius: 12, padding: 3, marginVertical: 12 },
  tabButton: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10 },
  tabButtonActive: { backgroundColor: "#1C1700", borderWidth: 0.5, borderColor: "rgba(255, 184, 0, 0.4)" },
  tabButtonText: { color: "#8E8E93", fontSize: 12, fontWeight: "600" },
  tabButtonTextActive: { color: "#FFB800", fontWeight: "800" },
  trackCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#0A0A0A", padding: 12, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: "#181818" },
  playButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#171400", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#FFB80044", marginRight: 12 },
  playButtonActive: { backgroundColor: "#FFB800" },
  trackInfo: { flex: 1 },
  trackTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  trackArtist: { color: "#8E8E93", fontSize: 13, marginTop: 2 },
  deleteBtn: { padding: 8 },
  uploadMiniBtn: { backgroundColor: "#FFB800", padding: 8, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  emptyState: { alignItems: "center", marginTop: 60, paddingHorizontal: 20 },
  emptyStateTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700", marginTop: 16 },
  emptyStateSubtitle: { color: "#8E8E93", fontSize: 13, textAlign: "center", marginTop: 8, lineHeight: 18 }
});
