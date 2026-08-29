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
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

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
              <Ionicons name="musical-notes" size={16} color="#FFB800" />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.idleTitle}>Transmitir Música no Grupo</Text>
              <Text style={styles.idleSub}>Toque para adicionar faixas da sua galeria à fila</Text>
            </View>
          </View>
          <View style={styles.idleActionBtn}>
            <Ionicons name="add" size={14} color="#000000" />
            <Text style={styles.idleActionText}>Tocar</Text>
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
      <View style={styles.progressBarTrack}>
        <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
      </View>

      <View style={styles.content}>
        <TouchableOpacity activeOpacity={0.8} onPress={onOpenQueue} style={styles.discWrapper}>
          <Animated.View style={[styles.disc, { transform: [{ rotate: spin }] }]}>
            <Ionicons name="disc" size={38} color="#FFB800" />
          </Animated.View>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.8} onPress={onOpenQueue} style={styles.infoWrapper}>
          <Text numberOfLines={1} style={styles.title}>
            {currentTrack.title}
          </Text>
          <View style={styles.metaRow}>
            <Text numberOfLines={1} style={styles.artist}>
              {currentTrack.artist}
            </Text>
            {currentTrack.added_by && (
              <View style={styles.badgeTag}>
                <Ionicons name="star" size={10} color="#FFB800" />
                <Text style={styles.badgeText}>@{currentTrack.added_by.username}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

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
                  size={20}
                  color="#000000"
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onSkip}
                style={styles.iconButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="play-skip-forward" size={18} color="#FFB800" />
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
    backgroundColor: "rgba(20, 17, 0, 0.95)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 184, 0, 0.3)",
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2B2200",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FFB80055"
  },
  idleTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700"
  },
  idleSub: {
    color: "#FFB800",
    fontSize: 11,
    marginTop: 1
  },
  idleActionBtn: {
    backgroundColor: "#FFB800",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4
  },
  idleActionText: {
    color: "#000000",
    fontSize: 12,
    fontWeight: "800"
  },
  container: {
    backgroundColor: "rgba(10, 10, 10, 0.94)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 184, 0, 0.25)",
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
    width: 38,
    height: 38,
    justifyContent: "center",
    alignItems: "center"
  },
  infoWrapper: {
    flex: 1,
    justifyContent: "center"
  },
  title: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700"
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2
  },
  artist: {
    color: "#8E8E93",
    fontSize: 12,
    maxWidth: 110
  },
  badgeTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1500",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    marginLeft: 6,
    borderWidth: 0.5,
    borderColor: "#FFB80044"
  },
  badgeText: {
    color: "#FFB800",
    fontSize: 10,
    fontWeight: "700",
    marginLeft: 3
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  goldPlayButton: {
    backgroundColor: "#FFB800",
    width: 32,
    height: 32,
    borderRadius: 16,
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
