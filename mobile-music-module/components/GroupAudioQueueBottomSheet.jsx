import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Platform
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
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
  const currentSeconds = Math.floor(progressMs / 1000);
  const totalSeconds = currentTrack?.duration || 0;
  const progressRatio = totalSeconds > 0 ? Math.min(1, currentSeconds / totalSeconds) : 0;

  // Espaçamento seguro para a barra de navegação do Android
  const bottomPadding = Math.max(20, insets.bottom + 16);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={[styles.sheetContainer, { paddingBottom: bottomPadding }]}>
          {/* Alça Superior */}
          <View style={styles.dragHandle} />

          {/* Cabeçalho */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <MaterialCommunityIcons name="music-box-multiple" size={20} color="#FFB800" />
              <Text style={styles.headerTitle}>Fila de Músicas da Tribo</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color="#8E8E93" />
            </TouchableOpacity>
          </View>

          {/* Seção: Tocando Agora */}
          {currentTrack ? (
            <View style={styles.nowPlayingCard}>
              <View style={styles.nowPlayingHeader}>
                <Text style={styles.sectionLabel}>TOCANDO AGORA</Text>
                {currentTrack.added_by && (
                  <Text style={styles.addedByText}>
                    por <Text style={{ color: "#FFB800" }}>@{currentTrack.added_by.username}</Text>
                  </Text>
                )}
              </View>

              <Text numberOfLines={1} style={styles.nowPlayingTitle}>{currentTrack.title}</Text>
              <Text numberOfLines={1} style={styles.nowPlayingArtist}>{currentTrack.artist}</Text>

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

              {/* Controles de Playback */}
              {isGold ? (
                <View style={styles.controlsRow}>
                  <TouchableOpacity
                    onPress={isPlaying ? onPause : onPlay}
                    style={styles.mainPlayButton}
                  >
                    <Ionicons name={isPlaying ? "pause" : "play"} size={28} color="#000000" />
                  </TouchableOpacity>

                  <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
                    <Ionicons name="play-skip-forward" size={22} color="#FFB800" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.listenerNotice}>
                  <Ionicons name="headset" size={16} color="#8E8E93" />
                  <Text style={styles.listenerNoticeText}>Ouvindo sincronizado com a Tribo</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.emptyPlayerCard}>
              <Ionicons name="musical-notes-outline" size={32} color="#333333" />
              <Text style={styles.emptyPlayerText}>Nenhuma música tocando no momento</Text>
            </View>
          )}

          {/* Seção: Lista a Seguir */}
          <Text style={[styles.sectionLabel, { marginHorizontal: 20, marginTop: 14, marginBottom: 8 }]}>
            A SEGUIR NA FILA ({queueList.length})
          </Text>

          <FlatList
            data={queueList}
            keyExtractor={(item, index) => item.id || String(index)}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 10 }}
            renderItem={({ item, index }) => (
              <View style={styles.queueItem}>
                <Text style={styles.queueIndex}>{index + 1}º</Text>
                <View style={styles.queueInfo}>
                  <Text numberOfLines={1} style={styles.queueTitle}>{item.title}</Text>
                  <Text numberOfLines={1} style={styles.queueArtist}>
                    {item.artist} • {formatTime(item.duration)}
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
                <Text style={styles.emptyQueueText}>A fila está vazia.</Text>
              </View>
            }
          />

          {/* Rodapé de Ação com Safe Area Spacing */}
          <View style={styles.footer}>
            {isGold ? (
              <TouchableOpacity style={styles.addTrackButton} onPress={onOpenAddModal} activeOpacity={0.85}>
                <Ionicons name="add-circle" size={22} color="#000000" />
                <Text style={styles.addTrackButtonText}>Adicionar Música da Minha Galeria</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.goldRestrictionBox}>
                <Ionicons name="star" size={14} color="#FFB800" />
                <Text style={styles.goldRestrictionText}>
                  Apenas membros com Selo Dourado podem adicionar faixas e controlar a reprodução.
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
    maxHeight: SCREEN_HEIGHT * 0.88,
    minHeight: SCREEN_HEIGHT * 0.58
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#141414"
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700"
  },
  sectionLabel: {
    color: "#8E8E93",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1
  },
  nowPlayingCard: {
    backgroundColor: "#121212",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 184, 0, 0.25)"
  },
  nowPlayingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6
  },
  addedByText: {
    color: "#8E8E93",
    fontSize: 12
  },
  nowPlayingTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800"
  },
  nowPlayingArtist: {
    color: "#A1A1AA",
    fontSize: 14,
    marginTop: 2
  },
  progressContainer: {
    marginTop: 14
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
    color: "#636366",
    fontSize: 11,
    fontWeight: "600"
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    gap: 18
  },
  mainPlayButton: {
    backgroundColor: "#FFB800",
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center"
  },
  skipButton: {
    backgroundColor: "#1C1C1E",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center"
  },
  listenerNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    gap: 6
  },
  listenerNoticeText: {
    color: "#8E8E93",
    fontSize: 12
  },
  emptyPlayerCard: {
    backgroundColor: "#121212",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1C1C1E"
  },
  emptyPlayerText: {
    color: "#8E8E93",
    fontSize: 14,
    marginTop: 8
  },
  queueItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121212",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: "#1F1F1F"
  },
  queueIndex: {
    color: "#FFB800",
    fontSize: 12,
    fontWeight: "800",
    width: 26
  },
  queueInfo: {
    flex: 1
  },
  queueTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600"
  },
  queueArtist: {
    color: "#8E8E93",
    fontSize: 12,
    marginTop: 2
  },
  deleteButton: {
    padding: 6
  },
  emptyQueueBox: {
    paddingVertical: 16,
    alignItems: "center"
  },
  emptyQueueText: {
    color: "#636366",
    fontSize: 13
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#141414"
  },
  addTrackButton: {
    backgroundColor: "#FFB800",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    shadowColor: "#FFB800",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4
  },
  addTrackButtonText: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "800"
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
