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
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
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
  const [activeTab, setActiveTab] = useState("device");
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
  }, [visible]);

  const loadTracks = async (term) => {
    setLoading(true);
    try {
      const data = await trackApi.listMyTracks(term);
      setTracks(data || []);
    } catch (e) {
      console.warn("Erro ao carregar faixas da nuvem:", e);
    } finally {
      setLoading(false);
    }
  };

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
        first: 100,
        sortBy: ["creationTime"]
      });

      if (media && media.assets) {
        setDeviceAudios(media.assets);
      }
    } catch (err) {
      console.warn("MediaLibrary fetch:", err.message);
    } finally {
      setLoadingDevice(false);
    }
  };

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
      Alert.alert("Erro ao Enviar", err.message || "Não foi possível carregar a faixa.");
    } finally {
      setUploading(false);
    }
  };

  const filteredDeviceAudios = deviceAudios.filter((item) => {
    if (!search.trim()) return true;
    const name = (item.filename || item.name || "").toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={[styles.content, { paddingBottom: bottomPadding }]}>
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Escolher Música para o Grupo</Text>
              <Text style={styles.subtitle}>A faixa tocará sincronizada para todos na Tribo</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#8E8E93" />
            </TouchableOpacity>
          </View>

          {/* Dica / Instrução Rápida */}
          <View style={styles.tipBox}>
            <MaterialCommunityIcons name="lightbulb-on-outline" size={16} color="#FFB800" />
            <Text style={styles.tipText}>
              Toque em qualquer música abaixo para iniciar a transmissão imediatamente.
            </Text>
          </View>

          {/* Abas */}
          <View style={styles.tabRow}>
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

            <TouchableOpacity
              style={[styles.tabButton, activeTab === "cloud" && styles.tabButtonActive]}
              onPress={() => {
                setActiveTab("cloud");
                loadTracks(search);
              }}
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
          </View>

          {/* Busca */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color="#8E8E93" />
            <TextInput
              style={styles.input}
              placeholder={activeTab === "device" ? "Buscar pelo nome do arquivo ou música..." : "Buscar na sua galeria na nuvem..."}
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

          {/* Lista: Celular */}
          {activeTab === "device" && (
            loadingDevice || uploading ? (
              <View style={{ alignItems: "center", marginVertical: 35 }}>
                <ActivityIndicator size="large" color="#FFB800" />
                <Text style={{ color: "#FFB800", marginTop: 10, fontSize: 13, fontWeight: "700" }}>
                  {uploading ? "Iniciando transmissão na Tribo..." : "Carregando músicas do aparelho..."}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredDeviceAudios}
                keyExtractor={(item, idx) => item.id || item.uri || String(idx)}
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
                    <View style={styles.playActionBtn}>
                      <Ionicons name="play" size={13} color="#000000" />
                      <Text style={styles.playActionText}>Tocar</Text>
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyBox}>
                    <Ionicons name="phone-portrait-outline" size={36} color="#333333" />
                    <Text style={styles.emptyText}>Nenhum arquivo de áudio encontrado.</Text>
                    <Text style={styles.emptySubText}>
                      Certifique-se de que possui arquivos .mp3 salvos no celular e que autorizou o acesso.
                    </Text>
                    <TouchableOpacity onPress={loadDeviceAudios} style={styles.permissionBtn}>
                      <Ionicons name="refresh" size={16} color="#000000" />
                      <Text style={styles.permissionBtnText}>Atualizar Permissões</Text>
                    </TouchableOpacity>
                  </View>
                }
              />
            )
          )}

          {/* Lista: Nuvem */}
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
                      <Ionicons name="cloud-done" size={20} color="#FFB800" />
                    </View>
                    <View style={styles.trackInfo}>
                      <Text numberOfLines={1} style={styles.trackTitle}>{item.title}</Text>
                      <Text numberOfLines={1} style={styles.trackArtist}>
                        {item.artist || "Desconhecido"} • {formatDuration(item.duration)}
                      </Text>
                    </View>
                    <View style={styles.playActionBtn}>
                      <Ionicons name="play" size={13} color="#000000" />
                      <Text style={styles.playActionText}>Tocar</Text>
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyBox}>
                    <Ionicons name="cloud-outline" size={36} color="#333333" />
                    <Text style={styles.emptyText}>Nenhuma música salva na nuvem ainda.</Text>
                    <Text style={styles.emptySubText}>
                      Toque na aba "Músicas do Celular" ao lado para tocar qualquer áudio do aparelho!
                    </Text>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    maxHeight: SCREEN_HEIGHT * 0.90,
    minHeight: SCREEN_HEIGHT * 0.62,
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
    marginBottom: 10
  },
  title: {
    color: "#FFFFFF",
    fontSize: 16.5,
    fontWeight: "800"
  },
  subtitle: {
    color: "#8E8E93",
    fontSize: 11.5,
    marginTop: 2
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#141414",
    alignItems: "center",
    justifyContent: "center"
  },
  tipBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#141100",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: "#FFB80033"
  },
  tipText: {
    color: "#FFB800",
    fontSize: 11.5,
    fontWeight: "600",
    flex: 1
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: "#121212",
    borderRadius: 12,
    padding: 3,
    marginBottom: 10
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
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
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121212",
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 10,
    height: 42,
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
    fontSize: 11.5,
    marginTop: 2
  },
  playActionBtn: {
    backgroundColor: "#FFB800",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4
  },
  playActionText: {
    color: "#000000",
    fontSize: 11.5,
    fontWeight: "800"
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 26,
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
    fontSize: 11.5,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 16
  },
  permissionBtn: {
    backgroundColor: "#FFB800",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    marginTop: 14,
    gap: 6
  },
  permissionBtnText: {
    color: "#000000",
    fontSize: 12,
    fontWeight: "800"
  }
});
