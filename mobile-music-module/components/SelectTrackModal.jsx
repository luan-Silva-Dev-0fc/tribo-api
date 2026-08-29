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
  Dimensions,
  Platform
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";
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
  const [deviceAudios, setDeviceAudios] = useState([]);
  const [activeTab, setActiveTab] = useState("cloud"); // 'cloud' ou 'device'
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingDevice, setLoadingDevice] = useState(false);
  const [uploading, setUploading] = useState(false);

  const bottomPadding = Math.max(20, insets.bottom + 16);

  useEffect(() => {
    if (visible) {
      loadTracks(search);
      loadDeviceAudios();
    }
  }, [visible, search]);

  const loadTracks = async (term) => {
    setLoading(true);
    try {
      const data = await trackApi.listMyTracks(term);
      setTracks(data || []);
    } catch (e) {
      console.warn("Erro ao buscar músicas da nuvem:", e);
    } finally {
      setLoading(false);
    }
  };

  // Carrega áudios locais diretamente da memória do celular
  const loadDeviceAudios = async () => {
    try {
      setLoadingDevice(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        setLoadingDevice(false);
        return;
      }

      const media = await MediaLibrary.getAssetsAsync({
        mediaType: "audio",
        first: 50,
        sortBy: ["creationTime"]
      });

      if (media && media.assets) {
        setDeviceAudios(media.assets);
      }
    } catch (err) {
      console.warn("MediaLibrary audio fetch notice:", err.message);
    } finally {
      setLoadingDevice(false);
    }
  };

  // Upload e reprodução de áudio local do celular
  const handleSelectDeviceAudio = async (asset) => {
    setUploading(true);
    try {
      const titleGuess = (asset.filename || asset.name || "Áudio").replace(/\.[^/.]+$/, "");

      const newTrack = await trackApi.uploadTrack({
        uri: asset.uri,
        name: asset.filename || "audio.mp3",
        type: "audio/mpeg",
        title: titleGuess,
        artist: "Música do Celular",
        duration: Math.round(asset.duration || 0)
      });

      if (newTrack) {
        onSelectTrack(newTrack);
        onClose();
      }
    } catch (err) {
      Alert.alert("Erro ao Enviar Áudio", err.message || "Não foi possível carregar a faixa.");
    } finally {
      setUploading(false);
    }
  };

  // Tenta abrir o DocumentPicker com fallback seguro
  const handlePickDocument = async () => {
    try {
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
          return;
        }
      } else {
        // Fallback: alterna para a aba do celular
        setActiveTab("device");
        loadDeviceAudios();
      }
    } catch (err) {
      setActiveTab("device");
      loadDeviceAudios();
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
              <Text style={styles.title}>Transmitir Música no Grupo</Text>
              <Text style={styles.subtitle}>Escolha uma música para tocar na Tribo</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color="#8E8E93" />
            </TouchableOpacity>
          </View>

          {/* Abas: Nuvem vs Celular */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === "cloud" && styles.tabButtonActive]}
              onPress={() => setActiveTab("cloud")}
            >
              <Ionicons
                name="cloud"
                size={16}
                color={activeTab === "cloud" ? "#FFB800" : "#8E8E93"}
              />
              <Text style={[styles.tabButtonText, activeTab === "cloud" && styles.tabButtonTextActive]}>
                Minha Nuvem ({tracks.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === "device" && styles.tabButtonActive]}
              onPress={() => {
                setActiveTab("device");
                if (deviceAudios.length === 0) loadDeviceAudios();
              }}
            >
              <Ionicons
                name="phone-portrait"
                size={16}
                color={activeTab === "device" ? "#FFB800" : "#8E8E93"}
              />
              <Text style={[styles.tabButtonText, activeTab === "device" && styles.tabButtonTextActive]}>
                Músicas do Celular ({deviceAudios.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Botão de Busca de Arquivo */}
          <TouchableOpacity
            style={styles.directUploadBtn}
            onPress={handlePickDocument}
            disabled={uploading}
            activeOpacity={0.85}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : (
              <>
                <View style={styles.uploadIconBox}>
                  <Feather name="folder-plus" size={18} color="#000000" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.uploadBtnTitle}>Abrir Arquivo do Aparelho</Text>
                  <Text style={styles.uploadBtnSub}>Selecionar áudio .mp3 ou .m4a</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#000000" />
              </>
            )}
          </TouchableOpacity>

          {/* Busca na Nuvem */}
          {activeTab === "cloud" && (
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color="#8E8E93" />
              <TextInput
                style={styles.input}
                placeholder="Filtrar por nome ou artista..."
                placeholderTextColor="#636366"
                value={search}
                onChangeText={setSearch}
              />
            </View>
          )}

          {/* Lista de Músicas na Nuvem */}
          {activeTab === "cloud" && (
            loading ? (
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
                      <Ionicons name="play" size={16} color="#000000" />
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyBox}>
                    <Ionicons name="cloud-outline" size={32} color="#333333" />
                    <Text style={styles.emptyText}>Nenhuma música na sua galeria na nuvem.</Text>
                    <Text style={styles.emptySubText}>
                      Toque na aba "Músicas do Celular" ao lado para tocar direto do aparelho!
                    </Text>
                  </View>
                }
              />
            )
          )}

          {/* Lista de Músicas do Aparelho (MediaLibrary) */}
          {activeTab === "device" && (
            loadingDevice || uploading ? (
              <View style={{ alignItems: "center", marginVertical: 30 }}>
                <ActivityIndicator size="large" color="#FFB800" />
                <Text style={{ color: "#8E8E93", marginTop: 8, fontSize: 13 }}>
                  {uploading ? "Carregando faixa para o grupo..." : "Buscando áudios no aparelho..."}
                </Text>
              </View>
            ) : (
              <FlatList
                data={deviceAudios}
                keyExtractor={(item) => item.id || item.uri}
                contentContainerStyle={{ paddingBottom: 20 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.trackCard}
                    onPress={() => handleSelectDeviceAudio(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.iconBox}>
                      <Ionicons name="musical-note" size={20} color="#FFB800" />
                    </View>
                    <View style={styles.trackInfo}>
                      <Text numberOfLines={1} style={styles.trackTitle}>
                        {(item.filename || item.name || "Áudio").replace(/\.[^/.]+$/, "")}
                      </Text>
                      <Text numberOfLines={1} style={styles.trackArtist}>
                        {formatDuration(item.duration)} • Armazenamento Local
                      </Text>
                    </View>
                    <View style={styles.playAddBadge}>
                      <Ionicons name="add" size={18} color="#000000" />
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyBox}>
                    <Ionicons name="phone-portrait-outline" size={32} color="#333333" />
                    <Text style={styles.emptyText}>Nenhum arquivo de áudio encontrado.</Text>
                    <TouchableOpacity onPress={loadDeviceAudios} style={{ marginTop: 10 }}>
                      <Text style={{ color: "#FFB800", fontWeight: "700" }}>Autorizar Permissão de Áudio</Text>
                    </TouchableOpacity>
                  </View>
                }
              />
            )
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
    paddingHorizontal: 18,
    paddingTop: 12,
    maxHeight: SCREEN_HEIGHT * 0.88,
    minHeight: SCREEN_HEIGHT * 0.6,
    borderTopWidth: 1,
    borderTopColor: "#1F1F1F"
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2C2C2E",
    alignSelf: "center",
    marginBottom: 10
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12
  },
  title: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800"
  },
  subtitle: {
    color: "#8E8E93",
    fontSize: 12,
    marginTop: 2
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: "#121212",
    borderRadius: 12,
    padding: 3,
    marginBottom: 12
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6
  },
  tabButtonActive: {
    backgroundColor: "#1C1700",
    borderWidth: 0.5,
    borderColor: "rgba(255, 184, 0, 0.4)"
  },
  tabButtonText: {
    color: "#8E8E93",
    fontSize: 12,
    fontWeight: "600"
  },
  tabButtonTextActive: {
    color: "#FFB800",
    fontWeight: "800"
  },
  directUploadBtn: {
    backgroundColor: "#FFB800",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    marginBottom: 12
  },
  uploadIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    justifyContent: "center",
    alignItems: "center"
  },
  uploadBtnTitle: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "800"
  },
  uploadBtnSub: {
    color: "#4A3600",
    fontSize: 11,
    marginTop: 1,
    fontWeight: "600"
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121212",
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 10,
    height: 40,
    borderWidth: 1,
    borderColor: "#1F1F1F"
  },
  input: {
    color: "#FFFFFF",
    flex: 1,
    marginLeft: 8,
    fontSize: 13
  },
  trackCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121212",
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#1A1A1A"
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#1A1500",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    borderWidth: 0.5,
    borderColor: "#FFB80033"
  },
  trackInfo: {
    flex: 1
  },
  trackTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700"
  },
  trackArtist: {
    color: "#8E8E93",
    fontSize: 11,
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
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8
  },
  emptySubText: {
    color: "#636366",
    fontSize: 11,
    textAlign: "center",
    marginTop: 4
  }
});
