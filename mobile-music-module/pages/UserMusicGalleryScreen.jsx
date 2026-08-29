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
      Alert.alert("Erro", err.response?.data?.message || "Falha ao carregar músicas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTracks(search);
  }, [search, loadTracks]);

  useEffect(() => {
    return () => {
      if (previewSound) {
        previewSound.unloadAsync();
      }
    };
  }, [previewSound]);

  const handleTogglePreview = async (track) => {
    if (playingTrackId === track.id) {
      if (previewSound) {
        await previewSound.stopAsync();
        await previewSound.unloadAsync();
      }
      setPreviewSound(null);
      setPlayingTrackId(null);
      return;
    }

    if (previewSound) {
      await previewSound.unloadAsync();
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

  const handlePickAndUpload = async () => {
    try {
      let file = null;
      let DocumentPicker = null;
      try {
        DocumentPicker = require("expo-document-picker");
      } catch (e) {}

      if (DocumentPicker && DocumentPicker.getDocumentAsync) {
        const result = await DocumentPicker.getDocumentAsync({
          type: ["audio/*", "audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/aac"],
          copyToCacheDirectory: true
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          file = result.assets[0];
        }
      }

      if (!file) {
        // Fallback MediaLibrary
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === "granted") {
          const media = await MediaLibrary.getAssetsAsync({ mediaType: "audio", first: 1 });
          if (media && media.assets && media.assets.length > 0) {
            file = media.assets[0];
          }
        }
      }

      if (!file) return;

      setUploading(true);
      const titleGuess = (file.name || file.filename || "Nova Música").replace(/\.[^/.]+$/, "");

      await trackApi.uploadTrack({
        uri: file.uri,
        name: file.name || file.filename || "audio.mp3",
        type: file.mimeType || "audio/mpeg",
        title: titleGuess,
        artist: "Minha Faixa"
      });

      Alert.alert("Sucesso", "Música adicionada à sua galeria!");
      loadTracks(search);
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
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation?.goBack?.()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Minha Galeria de Músicas</Text>
          <TouchableOpacity onPress={handlePickAndUpload} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator size="small" color="#FFB800" />
            ) : (
              <Ionicons name="cloud-upload" size={24} color="#FFB800" />
            )}
          </TouchableOpacity>
        </View>

        {/* Busca */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#8E8E93" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por música ou artista..."
            placeholderTextColor="#636366"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color="#8E8E93" />
            </TouchableOpacity>
          )}
        </View>

        {/* Lista */}
        {loading ? (
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
                <Text style={styles.emptyStateTitle}>Sua galeria está vazia</Text>
                <Text style={styles.emptyStateSubtitle}>
                  Faça o upload dos seus arquivos de áudio para poder transmiti-los com o Selo Dourado nos grupos da Tribo.
                </Text>
                <TouchableOpacity style={styles.uploadCtaButton} onPress={handlePickAndUpload}>
                  <Ionicons name="add" size={20} color="#000000" />
                  <Text style={styles.uploadCtaText}>Adicionar Música</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}

        {/* Botão Flutuante (FAB) */}
        <TouchableOpacity style={styles.fab} onPress={handlePickAndUpload} activeOpacity={0.85}>
          <Ionicons name="add" size={28} color="#000000" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#000000"
  },
  container: {
    flex: 1,
    backgroundColor: "#000000",
    paddingHorizontal: 16
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14
  },
  backButton: {
    padding: 4
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800"
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0A0A0A",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: "#1F1F1F"
  },
  searchInput: {
    flex: 1,
    color: "#FFFFFF",
    marginLeft: 8,
    fontSize: 14
  },
  trackCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0A0A0A",
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#181818"
  },
  playButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#171400",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FFB80044",
    marginRight: 12
  },
  playButtonActive: {
    backgroundColor: "#FFB800"
  },
  trackInfo: {
    flex: 1
  },
  trackTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700"
  },
  trackArtist: {
    color: "#8E8E93",
    fontSize: 13,
    marginTop: 2
  },
  deleteBtn: {
    padding: 8
  },
  emptyState: {
    alignItems: "center",
    marginTop: 60,
    paddingHorizontal: 20
  },
  emptyStateTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 16
  },
  emptyStateSubtitle: {
    color: "#8E8E93",
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 18
  },
  uploadCtaButton: {
    backgroundColor: "#FFB800",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 20,
    gap: 6
  },
  uploadCtaText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "800"
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    backgroundColor: "#FFB800",
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#FFB800",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6
  }
});
