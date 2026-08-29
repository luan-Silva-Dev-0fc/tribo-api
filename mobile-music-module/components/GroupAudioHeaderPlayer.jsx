import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

function formatTime(ms) {
  const totalSec = Math.floor((ms || 0) / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export function GroupAudioHeaderPlayer({
  currentTrack,
  isPlaying,
  isGold,
  isMuted,
  progressMs = 0,
  queueCount = 0,
  onPlay,
  onPause,
  onSkip,
  onToggleMute,
  onOpenQueue
}) {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let anim = null;
    if (isPlaying) {
      rotateAnim.setValue(0);
      anim = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 6000,
          easing: Easing.linear,
          useNativeDriver: true
        })
      );
      anim.start();
    } else {
      rotateAnim.stopAnimation();
    }
    return () => {
      if (anim) anim.stop();
    };
  }, [isPlaying]);

  // Se nenhuma música estiver tocando
  if (!currentTrack) {
    if (isGold) {
      return (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onOpenQueue}
          style={styles.idleBanner}
        >
          <View style={styles.idleLeft}>
            <View style={styles.idleIconBox}>
              <Ionicons name="musical-notes" size={18} color="#FFB800" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={styles.liveTagRow}>
                <View style={styles.idleDot} />
                <Text style={styles.idleTagText}>TRANSMISSÃO DE ÁUDIO</Text>
              </View>
              <Text style={styles.idleTitle}>Transmitir Música no Grupo</Text>
              <Text style={styles.idleSub}>Toque para escolher faixas e ouvir com a Tribo</Text>
            </View>
          </View>
          <View style={styles.idleActionBtn}>
            <Ionicons name="play" size={13} color="#000000" />
            <Text style={styles.idleActionText}>Iniciar</Text>
          </View>
        </TouchableOpacity>
      );
    }
    return null;
  }

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"]
  });

  const totalDurationMs = (currentTrack.duration || 0) * 1000;
  const progressPercent = totalDurationMs > 0
    ? Math.min(100, Math.max(0, (progressMs / totalDurationMs) * 100))
    : 0;

  return (
    <View style={styles.container}>
      {/* Barra de Progresso Superior Dourada */}
      <View style={styles.progressBarTrack}>
        <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
      </View>

      <View style={styles.content}>
        {/* Disco de Vinil Animado */}
        <TouchableOpacity activeOpacity={0.8} onPress={onOpenQueue} style={styles.discWrapper}>
          <Animated.View style={[styles.disc, { transform: [{ rotate: spin }] }]}>
            <Ionicons name="disc" size={40} color="#FFB800" />
          </Animated.View>
        </TouchableOpacity>

        {/* Informações da Música */}
        <TouchableOpacity activeOpacity={0.8} onPress={onOpenQueue} style={styles.infoWrapper}>
          <View style={styles.liveBadgeRow}>
            <View style={styles.pulseDot} />
            <Text style={styles.liveBadgeText}>AO VIVO NA TRIBO</Text>
            <Text style={styles.timeCounterText}>
              • {formatTime(progressMs)} / {formatTime(totalDurationMs)}
            </Text>
          </View>

          <Text numberOfLines={1} style={styles.title}>
            {currentTrack.title}
          </Text>

          <View style={styles.metaRow}>
            <Text numberOfLines={1} style={styles.artist}>
              {currentTrack.artist || "Desconhecido"}
            </Text>
            {currentTrack.added_by && (
              <View style={styles.badgeTag}>
                <Ionicons name="star" size={9} color="#FFB800" />
                <Text style={styles.badgeText}>@{currentTrack.added_by.username || currentTrack.added_by.name}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Ações e Controles */}
        <View style={styles.actionsRow}>
          {isGold ? (
            <>
              <TouchableOpacity
                onPress={isPlaying ? onPause : onPlay}
                style={styles.goldPlayButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={isPlaying ? "pause" : "play"}
                  size={18}
                  color="#000000"
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onSkip}
                style={styles.iconButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="play-skip-forward" size={17} color="#FFB800" />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              onPress={onToggleMute}
              style={styles.iconButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={isMuted ? "volume-mute" : "volume-high"}
                size={20}
                color={isMuted ? "#8E8E93" : "#FFB800"}
              />
            </TouchableOpacity>
          )}

          {/* Botão de Fila */}
          <TouchableOpacity
            onPress={onOpenQueue}
            style={styles.queueButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name="playlist-music" size={22} color="#FFFFFF" />
            {queueCount > 0 && (
              <View style={styles.queueBadge}>
                <Text style={styles.queueBadgeText}>{queueCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default GroupAudioHeaderPlayer;

const styles = StyleSheet.create({
  idleBanner: {
    backgroundColor: "#0D0B00",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 184, 0, 0.25)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    zIndex: 100
  },
  idleLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1
  },
  idleIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1F1800",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FFB80055"
  },
  liveTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  idleDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#FFB800"
  },
  idleTagText: {
    color: "#FFB800",
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.5
  },
  idleTitle: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "700"
  },
  idleSub: {
    color: "#A1A1AA",
    fontSize: 11,
    marginTop: 1
  },
  idleActionBtn: {
    backgroundColor: "#FFB800",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 16,
    gap: 5
  },
  idleActionText: {
    color: "#000000",
    fontSize: 12,
    fontWeight: "800"
  },
  container: {
    backgroundColor: "rgba(10, 10, 10, 0.96)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 184, 0, 0.22)",
    zIndex: 100
  },
  progressBarTrack: {
    height: 2.5,
    backgroundColor: "#1C1C1E",
    width: "100%"
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#FFB800"
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  discWrapper: {
    marginRight: 10
  },
  disc: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center"
  },
  infoWrapper: {
    flex: 1,
    justifyContent: "center"
  },
  liveBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 1
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22c55e"
  },
  liveBadgeText: {
    color: "#22c55e",
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.5
  },
  timeCounterText: {
    color: "#8E8E93",
    fontSize: 9.5,
    fontWeight: "600"
  },
  title: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700"
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 1
  },
  artist: {
    color: "#8E8E93",
    fontSize: 11.5,
    maxWidth: 110
  },
  badgeTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1C1700",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    marginLeft: 6,
    borderWidth: 0.5,
    borderColor: "#FFB80044"
  },
  badgeText: {
    color: "#FFB800",
    fontSize: 9.5,
    fontWeight: "700",
    marginLeft: 3
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  goldPlayButton: {
    backgroundColor: "#FFB800",
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center"
  },
  iconButton: {
    padding: 6
  },
  queueButton: {
    padding: 6,
    position: "relative"
  },
  queueBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "#FFB800",
    borderRadius: 7,
    minWidth: 14,
    height: 14,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2
  },
  queueBadgeText: {
    color: "#000000",
    fontSize: 9,
    fontWeight: "900"
  }
});
