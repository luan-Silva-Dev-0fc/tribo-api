import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Image
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import { api } from "../../api";
import { listFrom } from "../../lib/format";
import { FollowRequestsModal } from "../modals/follow-requests-modal";

export function AppShell({
  children,
  active,
  onNavigate,
  onCreateTribo,
  onOpenMessages,
  onOpenProfile
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const barBg = colors.card || "#121214";

  const tabs = [
    ["feed", "home", "Feed"],
    ["reels", "movie-play", "Reels"],
    ["search", "search", "Busca"],
    ["profile", "user", "Perfil"]
  ];

  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [followRequestsVisible, setFollowRequestsVisible] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const [reqRes, notRes] = await Promise.all([
        api.users.followRequests().catch(() => null),
        api.notifications.list().catch(() => null)
      ]);
      const listReq = listFrom(reqRes, ["requests", "users", "data"]);
      const listNotif =
        listFrom(notRes, ["notifications", "data"]) || notRes || [];
      const unreadNotif = Array.isArray(listNotif)
        ? listNotif.filter((n) => !n.is_read && !n.isRead)
        : [];
      setPendingRequestsCount(listReq.length + unreadNotif.length);
    } catch (err) {}
  }, []);

  useEffect(() => {
    if (active === "feed") {
      fetchRequests();
    }
  }, [active, fetchRequests]);

  return (
    <View style={[styles.root, { backgroundColor: barBg }]}>
      {/* Header Superior */}
      <View
        style={[
          styles.header,
          { backgroundColor: "#000000" },
          active === "reels" && {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            backgroundColor: "transparent",
            borderBottomWidth: 0,
            height: 100
          }
        ]}
      >
        <View style={styles.headerContent}>
          <View style={styles.logoContainer}>
            <Ionicons name="people" size={28} color="#ffffff" />
            <Text style={styles.wordmark}>Tribo</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={styles.iconButton}
              onPress={() => setFollowRequestsVisible(true)}
            >
              <Feather name="bell" size={20} color="#ffffff" />
              {pendingRequestsCount > 0 && <View style={styles.badge} />}
            </Pressable>

            <Pressable style={styles.iconButton} onPress={onOpenMessages}>
              <Feather name="message-square" size={20} color="#ffffff" />
            </Pressable>

            <Pressable style={styles.iconButton} onPress={onCreateTribo}>
              <Feather name="plus" size={20} color="#ffffff" />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Conteúdo Principal */}
      <View style={[styles.content, { backgroundColor: "#000000" }]}>
        {children}
      </View>

      {/* Footer / Barra de Navegação Inferior (Cinza Escuro da Interface) */}
      <View
        style={[
          styles.footerContainer,
          {
            backgroundColor: barBg,
            borderTopWidth: 1,
            borderTopColor: "rgba(255, 255, 255, 0.08)"
          }
        ]}
      >
        <View
          style={[
            styles.navBar,
            {
              backgroundColor: barBg,
              paddingBottom: Math.max(
                insets.bottom,
                Platform.OS === "android" ? 12 : 8
              )
            }
          ]}
        >
          {tabs.map(([id, icon, label]) => {
            const isActive = active === id;
            const activeColor = "#FFFFFF";
            const inactiveColor = "#71717A";

            return (
              <Pressable
                key={id}
                onPress={() => onNavigate(id)}
                style={styles.tab}
              >
                {({ pressed }) => (
                  <View
                    style={[styles.tabContent, { opacity: pressed ? 0.6 : 1 }]}
                  >
                    <View style={styles.tabIcon}>
                      {id === "trends" ? (
                        <Image
                          source={{
                            uri: "https://pub-08d4ac7de5354fadbfe07fcbc70237ba.r2.dev/jornal.png"
                          }}
                          style={{
                            width: 22,
                            height: 22,
                            tintColor: isActive ? activeColor : inactiveColor
                          }}
                          resizeMode="contain"
                        />
                      ) : id === "reels" ? (
                        <MaterialCommunityIcons
                          name={isActive ? "movie-play" : "movie-play-outline"}
                          size={24}
                          color={isActive ? activeColor : inactiveColor}
                        />
                      ) : (
                        <Feather
                          name={icon}
                          size={22}
                          color={isActive ? activeColor : inactiveColor}
                        />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.tabText,
                        {
                          color: isActive ? activeColor : inactiveColor,
                          fontFamily: isActive
                            ? "Poppins_600SemiBold"
                            : "Poppins_400Regular"
                        }
                      ]}
                    >
                      {label}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      <FollowRequestsModal
        visible={followRequestsVisible}
        onClose={() => setFollowRequestsVisible(false)}
        onOpenProfile={onOpenProfile}
        onRequestHandled={() => {
          fetchRequests();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  header: {
    height: 140,
    backgroundColor: "#000000",
    paddingHorizontal: 20,
    paddingTop: 20,
    flexDirection: "row",
    alignItems: "flex-start",
    zIndex: 1
  },
  headerContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  wordmark: {
    color: "#ffffff",
    fontFamily: "Poppins_700Bold",
    fontSize: 28,
    letterSpacing: -0.5
  },
  headerActions: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#222222",
    alignItems: "center",
    justifyContent: "center",
    position: "relative"
  },
  badge: {
    position: "absolute",
    top: 6,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
    borderWidth: 1.5,
    borderColor: "#222222"
  },
  content: {
    flex: 1,
    zIndex: 5,
    backgroundColor: "#000000"
  },
  footerContainer: {
    width: "100%",
    zIndex: 100
  },
  navBar: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: 8
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  tabContent: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3
  },
  tabIcon: {
    height: 26,
    alignItems: "center",
    justifyContent: "center"
  },
  tabText: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center"
  }
});
