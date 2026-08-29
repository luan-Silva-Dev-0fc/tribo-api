import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Dimensions
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export function GroupAudioQueueBottomSheet({
  visible,
  onClose,
  currentTrack,
  queueList = [],
  isPlaying,
  isGold,
  progressMs = 0,
  onPlay,
  onPause,
  onSkip,
  onRemoveTrack,
  onOpenAddModal
}) {
  const insets = useSafeAreaInsets();
  const currentSeconds = Math.floor((progressMs || 0) / 1000);
  const totalSeconds = currentTrack?.duration || 0;
  const progressRatio = totalSeconds > 0 ? Math.min(1, currentSeconds / totalSeconds) : 0;

  const bottomPadding = Math.max(20, insets.bottom + 16);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={[styles.sheetContainer, { paddingBottom: bottomPadding }]}>
          <View style={styles.dragHandle} />

          {/* Cabeçalho com Instruções */}
          <View style={styles.header}>
            <View>
              <View style={styles.headerTitleRow}>
                <MaterialCommunityIcons name="music-box-multiple" size={20} color="#FFB800" />
                <Text style={styles.headerTitle}>Fila de Músicas da Tribo</Text>
              </View>
              <Text style={styles.headerSubtitle}>
                Áudio sincronizado ao vivo para todos os membros 🎧
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#8E8E93" />
            </TouchableOpacity>
          </View>

          {/* Banner de Permissão / Papel do Usuário */}
          <View style={[styles.permissionBanner, isGold ? styles.goldBannerBg : styles.listenerBannerBg]}>
            <Ionicons
              name={isGold ? "star" : "information-circle-outline"}
              size={15}
              color={isGold ? "#FFB800" : "#8E8E93"}
            />
            <Text style={[styles.permissionText, isGold ? styles.goldText : styles.listenerText]}>
              {isGold
                ? "⭐ Você possui Selo Dourado: Pode adicionar músicas, pausar e pular faixas."
                : "🎧 Você está ouvindo a transmissão da Tribo. Apenas Selo Dourado gerencia a fila."}
            </Text>
          </View>

          {/* Card: Tocando Agora */}
          {currentTrack ? (
            <View style={styles.nowPlayingCard}>
              <View style={styles.nowPlayingHeader}>
                <View style={styles.liveIndicator}>
                  <View style={styles.greenPulse} />
                  <Text style={styles.sectionLabel}>TOCANDO AGORA</Text>
                </View>
                {currentTrack.added_by && (
                  <View style={styles.addedByTag}>
                    <Text style={styles.addedByText}>
                      por <Text style={{ color: "#FFB800", fontWeight: "700" }}>@{currentTrack.added_by.username || currentTrack.added_by.name}</Text>
                    </Text>
                  </View>
                )}
              </View>

              <Text numberOfLines={1} style={styles.nowPlayingTitle}>{currentTrack.title}</Text>
              <Text numberOfLines={1} style={styles.nowPlayingArtist}>{currentTrack.artist || "Artista Desconhecido"}</Text>

              {/* Barra de Progresso */}
              <View style={styles.progressContainer}>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarActive, { width: `${progressRatio * 100}%` }]} />
                </View>
                <View style={styles.timeRow}>
                  <Text style={styles.timeText}>{formatTime(currentSeconds)}</Text>
                  <Text style={styles.timeText}>{formatTime(totalSeconds)}</Text>
                </View>
              </View>

              {/* Controles de Reprodução */}
              {isGold ? (
                <View style={styles.controlsRow}>
                  <TouchableOpacity
                    onPress={isPlaying ? onPause : onPlay}
                    style={styles.mainPlayButton}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={isPlaying ? "pause" : "play"} size={26} color="#000000" />
                  </TouchableOpacity>

                  <TouchableOpacity onPress={onSkip} style={styles.skipButton} activeOpacity={0.8}>
                    <Ionicons name="play-skip-forward" size={20} color="#FFB800" />
                    <Text style={styles.skipText}>Pular</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.listenerNotice}>
                  <Ionicons name="headset" size={15} color="#8E8E93" />
                  <Text style={styles.listenerNoticeText}>Ouvindo sincronizado na Tribo</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.emptyPlayerCard}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="musical-notes" size={28} color="#FFB800" />
              </View>
              <Text style={styles.emptyPlayerTitle}>Nenhuma música tocando agora</Text>
              <Text style={styles.emptyPlayerSub}>
                Toque no botão abaixo para escolher uma música do seu celular e iniciar a reprodução!
              </Text>
            </View>
          )}

          {/* Seção: A Seguir */}
          <View style={styles.queueHeaderRow}>
            <Text style={styles.queueSectionLabel}>A SEGUIR NA FILA ({queueList.length})</Text>
            {queueList.length > 0 && (
              <Text style={styles.queueHelperText}>Tocam automaticamente em sequência</Text>
            )}
          </View>

          <FlatList
            data={queueList}
            keyExtractor={(item, index) => item.id || String(index)}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 10 }}
            renderItem={({ item, index }) => (
              <View style={styles.queueItem}>
                <View style={styles.indexCircle}>
                  <Text style={styles.queueIndex}>{index + 1}º</Text>
                </View>
                <View style={styles.queueInfo}>
                  <Text numberOfLines={1} style={styles.queueTitle}>{item.title}</Text>
                  <Text numberOfLines={1} style={styles.queueArtist}>
                    {item.artist || "Desconhecido"} • {formatTime(item.duration)}
                  </Text>
                </View>

                {isGold && (
                  <TouchableOpacity
                    onPress={() => onRemoveTrack(item.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.deleteButton}
                  >
                    <Ionicons name="trash-outline" size={18} color="#FF453A" />
                  </TouchableOpacity>
                )}
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyQueueBox}>
                <Text style={styles.emptyQueueText}>Não há mais músicas na fila de espera.</Text>
              </View>
            }
          />

          {/* Rodapé com Botão Principal e Instrução */}
          <View style={styles.footer}>
            {isGold ? (
              <TouchableOpacity style={styles.addTrackButton} onPress={onOpenAddModal} activeOpacity={0.85}>
                <Ionicons name="add-circle" size={22} color="#000000" />
                <View style={{ alignItems: "center" }}>
                  <Text style={styles.addTrackButtonText}>Adicionar Música à Fila</Text>
                  <Text style={styles.addTrackSubText}>Escolha arquivos .mp3 do seu celular ou nuvem</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.goldRestrictionBox}>
                <Ionicons name="star" size={15} color="#FFB800" />
                <Text style={styles.goldRestrictionText}>
                  Apenas membros com Selo Dourado podem colocar músicas na fila do grupo.
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.75)"
  },
  backdrop: {
    flex: 1
  },
  sheetContainer: {
    backgroundColor: "#0A0A0A",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: "#1F1F1F",
    maxHeight: SCREEN_HEIGHT * 0.90,
    minHeight: SCREEN_HEIGHT * 0.60
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2C2C2E",
    alignSelf: "center",
    marginTop: 10
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 16.5,
    fontWeight: "800"
  },
  headerSubtitle: {
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
  permissionBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 8
  },
  goldBannerBg: {
    backgroundColor: "#171400",
    borderWidth: 0.5,
    borderColor: "#FFB80033"
  },
  listenerBannerBg: {
    backgroundColor: "#121212",
    borderWidth: 0.5,
    borderColor: "#1F1F1F"
  },
  permissionText: {
    fontSize: 11.5,
    flex: 1
  },
  goldText: {
    color: "#FFB800",
    fontWeight: "600"
  },
  listenerText: {
    color: "#8E8E93"
  },
  nowPlayingCard: {
    backgroundColor: "#121212",
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 184, 0, 0.3)"
  },
  nowPlayingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  greenPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22c55e"
  },
  sectionLabel: {
    color: "#22c55e",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5
  },
  addedByTag: {
    backgroundColor: "#1C1700",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "#FFB80033"
  },
  addedByText: {
    color: "#8E8E93",
    fontSize: 11
  },
  nowPlayingTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800"
  },
  nowPlayingArtist: {
    color: "#A1A1AA",
    fontSize: 13,
    marginTop: 2
  },
  progressContainer: {
    marginTop: 10
  },
  progressBarBg: {
    height: 4,
    backgroundColor: "#1C1C1E",
    borderRadius: 2,
    overflow: "hidden"
  },
  progressBarActive: {
    height: "100%",
    backgroundColor: "#FFB800"
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4
  },
  timeText: {
    color: "#71717A",
    fontSize: 11,
    fontWeight: "600"
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    gap: 16
  },
  mainPlayButton: {
    backgroundColor: "#FFB800",
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center"
  },
  skipButton: {
    backgroundColor: "#1C1700",
    borderWidth: 1,
    borderColor: "#FFB80044",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    gap: 5
  },
  skipText: {
    color: "#FFB800",
    fontSize: 12,
    fontWeight: "700"
  },
  listenerNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    gap: 6
  },
  listenerNoticeText: {
    color: "#8E8E93",
    fontSize: 12
  },
  emptyPlayerCard: {
    backgroundColor: "#121212",
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1C1C1E"
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1C1700",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FFB80044",
    marginBottom: 8
  },
  emptyPlayerTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700"
  },
  emptyPlayerSub: {
    color: "#8E8E93",
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 16,
    paddingHorizontal: 10
  },
  queueHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 18,
    marginTop: 14,
    marginBottom: 8
  },
  queueSectionLabel: {
    color: "#8E8E93",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8
  },
  queueHelperText: {
    color: "#52525B",
    fontSize: 10.5
  },
  queueItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121212",
    padding: 10,
    borderRadius: 12,
    marginBottom: 7,
    borderWidth: 0.5,
    borderColor: "#1F1F1F"
  },
  indexCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#1C1700",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10
  },
  queueIndex: {
    color: "#FFB800",
    fontSize: 11,
    fontWeight: "800"
  },
  queueInfo: {
    flex: 1
  },
  queueTitle: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "600"
  },
  queueArtist: {
    color: "#8E8E93",
    fontSize: 11.5,
    marginTop: 1
  },
  deleteButton: {
    padding: 6
  },
  emptyQueueBox: {
    paddingVertical: 12,
    alignItems: "center"
  },
  emptyQueueText: {
    color: "#52525B",
    fontSize: 12
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#141414"
  },
  addTrackButton: {
    backgroundColor: "#FFB800",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
    shadowColor: "#FFB800",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4
  },
  addTrackButtonText: {
    color: "#000000",
    fontSize: 14.5,
    fontWeight: "800"
  },
  addTrackSubText: {
    color: "#3D2B00",
    fontSize: 10.5,
    fontWeight: "600"
  },
  goldRestrictionBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#141100",
    padding: 12,
    borderRadius: 10,
    gap: 8,
    borderWidth: 0.5,
    borderColor: "#FFB80033"
  },
  goldRestrictionText: {
    color: "#FFB800",
    fontSize: 12,
    flex: 1
  }
});
