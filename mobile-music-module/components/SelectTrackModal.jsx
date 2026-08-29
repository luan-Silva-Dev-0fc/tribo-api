import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Dimensions
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { trackApi } from "../../services/trackApi";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

function formatDuration(sec) {
  const m = Math.floor((sec || 0) / 60);
  const s = Math.floor((sec || 0) % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export function SelectTrackModal({ visible, onClose, onSelectTrack }) {
  const insets = useSafeAreaInsets();
  const [tracks, setTracks] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const bottomPadding = Math.max(20, insets.bottom + 16);

  useEffect(() => {
    if (visible) {
      loadTracks(search);
    }
  }, [visible, search]);

  const loadTracks = async (term) => {
    setLoading(true);
    try {
      const data = await trackApi.listMyTracks(term);
      setTracks(data || []);
    } catch (e) {
      console.warn("Erro ao buscar músicas da galeria:", e);
    } finally {
      setLoading(false);
    }
  };

  // Upload direto de arquivo do celular para a fila do grupo
  const handlePickDirectAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["audio/mpeg", "audio/mp4", "audio/aac", "audio/x-m4a", "audio/*"],
        copyToCacheDirectory: true
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const file = result.assets[0];
      setUploading(true);

      const titleGuess = file.name.replace(/\.[^/.]+$/, "");

      const newTrack = await trackApi.uploadTrack({
        uri: file.uri,
        name: file.name,
        type: file.mimeType || "audio/mpeg",
        title: titleGuess,
        artist: "Minha Faixa"
      });

      if (newTrack) {
        onSelectTrack(newTrack);
        onClose();
      }
    } catch (err) {
      Alert.alert("Erro no Upload", err.message || "Não foi possível carregar o áudio.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={[styles.content, { paddingBottom: bottomPadding }]}>
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Transmitir Música</Text>
              <Text style={styles.subtitle}>Escolha do aparelho ou da sua galeria</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color="#8E8E93" />
            </TouchableOpacity>
          </View>

          {/* Botão de Upload Direto do Celular */}
          <TouchableOpacity
            style={styles.directUploadBtn}
            onPress={handlePickDirectAudio}
            disabled={uploading}
            activeOpacity={0.85}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : (
              <>
                <View style={styles.uploadIconBox}>
                  <Feather name="folder-plus" size={20} color="#000000" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.uploadBtnTitle}>Escolher Áudio do Meu Celular</Text>
                  <Text style={styles.uploadBtnSub}>Buscar arquivos .mp3, .m4a no dispositivo</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#000000" />
              </>
            )}
          </TouchableOpacity>

          {/* Divisor */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OU DA SUA GALERIA NA NUVEM</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Busca */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#8E8E93" />
            <TextInput
              style={styles.input}
              placeholder="Buscar título ou artista na galeria..."
              placeholderTextColor="#636366"
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={16} color="#8E8E93" />
              </TouchableOpacity>
            )}
          </View>

          {/* Lista de Faixas Salvas */}
          {loading ? (
            <ActivityIndicator size="large" color="#FFB800" style={{ marginVertical: 30 }} />
          ) : (
            <FlatList
              data={tracks}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.trackCard}
                  onPress={() => {
                    onSelectTrack(item);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.iconBox}>
                    <Ionicons name="musical-notes" size={20} color="#FFB800" />
                  </View>
                  <View style={styles.trackInfo}>
                    <Text numberOfLines={1} style={styles.trackTitle}>{item.title}</Text>
                    <Text numberOfLines={1} style={styles.trackArtist}>
                      {item.artist} • {formatDuration(item.duration)}
                    </Text>
                  </View>
                  <View style={styles.playAddBadge}>
                    <Ionicons name="add" size={18} color="#000000" />
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Ionicons name="musical-note-outline" size={32} color="#333333" />
                  <Text style={styles.emptyText}>Nenhuma música salva na galeria da nuvem.</Text>
                  <Text style={styles.emptySubText}>
                    Use o botão acima para escolher um arquivo .mp3 direto do seu celular!
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end"
  },
  backdrop: {
    flex: 1
  },
  content: {
    backgroundColor: "#0A0A0A",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: SCREEN_HEIGHT * 0.85,
    minHeight: SCREEN_HEIGHT * 0.55,
    borderTopWidth: 1,
    borderTopColor: "#1F1F1F"
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2C2C2E",
    alignSelf: "center",
    marginBottom: 12
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14
  },
  title: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800"
  },
  subtitle: {
    color: "#8E8E93",
    fontSize: 12,
    marginTop: 2
  },
  directUploadBtn: {
    backgroundColor: "#FFB800",
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    marginBottom: 14
  },
  uploadIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    justifyContent: "center",
    alignItems: "center"
  },
  uploadBtnTitle: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "800"
  },
  uploadBtnSub: {
    color: "#4A3600",
    fontSize: 11,
    marginTop: 1,
    fontWeight: "600"
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#1C1C1E"
  },
  dividerText: {
    color: "#636366",
    fontSize: 10,
    fontWeight: "700",
    marginHorizontal: 10,
    letterSpacing: 0.5
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121212",
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 12,
    height: 44,
    borderWidth: 1,
    borderColor: "#1F1F1F"
  },
  input: {
    color: "#FFFFFF",
    flex: 1,
    marginLeft: 8,
    fontSize: 14
  },
  trackCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121212",
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#1C1C1E"
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#1A1500",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 0.5,
    borderColor: "#FFB80033"
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
    fontSize: 12,
    marginTop: 2
  },
  playAddBadge: {
    backgroundColor: "#FFB800",
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center"
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 20
  },
  emptyText: {
    color: "#8E8E93",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8
  },
  emptySubText: {
    color: "#636366",
    fontSize: 12,
    textAlign: "center",
    marginTop: 4
  }
});
