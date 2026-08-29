import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useImperativeHandle
} from "react";
import { Audio } from "expo-av";
import { useVideoPlayer, VideoView } from "expo-video";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
  Keyboard,
  LayoutAnimation
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { api, getUploadUrl } from "../../../api";
import { Avatar, CustomModal } from "../../../components/ui/ui";
import { useTheme } from "../../../theme";
import { errorMessage, userName } from "../../../lib/format";
import { AudioMessagePlayer } from "../../../components/chat/AudioMessagePlayer";
import { ReelShareCard } from "../../../components/chat/ReelShareCard";
import { MediaViewerModal } from "../../../components/modals/media-viewer-modal";
import { GoldBadgeBenefitsModal } from "../../../components/modals/gold-badge-modal";
import { VideoStickerMessage } from "../../../components/chat/VideoStickerMessage";
import { CreateVideoStickerModal } from "../../../components/chat/CreateVideoStickerModal";
import { StickerPickerModal } from "../../../components/chat/StickerPickerModal";
import { ViewOnceMediaCard } from "../../../components/chat/ViewOnceMediaCard";
import { ViewOnceAudioPlayer } from "../../../components/chat/ViewOnceAudioPlayer";
import { ViewOnceStickerMessage } from "../../../components/chat/ViewOnceStickerMessage";
import { SwipeableMessageRow } from "../../../components/chat/SwipeableMessageRow";
import { ReplyPreviewBar } from "../../../components/chat/ReplyPreviewBar";
import { QuotedMessageBlock } from "../../../components/chat/QuotedMessageBlock";
import { MediaContextMenuSheet } from "../../../components/chat/MediaContextMenuSheet";
import { ConfirmDeleteModal } from "../../../components/chat/ConfirmDeleteModal";
import { TriboModernToast } from "../../../components/chat/TriboModernToast";
import { saveMediaToGallery } from "../../../services/mediaDownloadService";
import { saveStickerToInventory } from "../../../services/stickerInventory";
import {
  getExpiredMessageIds,
  markMessageAsExpired,
  sanitizeMessagesWithExpiration
} from "../../../services/viewOnceService";
import {
  clearChatHistory,
  exportChatHistory,
  filterClearedMessages,
  getClearedChatTimestamp
} from "../../../services/chatExportService";
import { getChatSocket } from "../../../services/chatSocket";
import { ChatCache } from "../../../services/chatCache";
import { NativeOptimization } from "../../../services/nativeOptimization";
import {
  setOptimizedAudioMode,
  setLiveVoiceAudioMode,
  setAudioRecordingActive,
  notifyChatScroll
} from "../../../services/audioRecordingDucking";
import { liveVoiceStreamer } from "../../../services/liveVoiceStreamer";
import { duckGroupAudio } from "../../../hooks/useGroupAudioSync";

function formatAudioTime(millis) {
  const totalSeconds = Math.floor(millis / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m + ":" + (s < 10 ? "0" : "") + s;
}

const ChatVideoThumbnail = React.memo(function ChatVideoThumbnail({
  url,
  onPress,
  onLongPress
}) {
  if (!url || typeof url !== "string" || !url.trim()) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={200}
        style={{
          width: 230,
          height: 230,
          borderRadius: 16,
          backgroundColor: "#18181b",
          borderWidth: 1,
          borderColor: "rgba(255, 255, 255, 0.08)"
        }}
      />
    );
  }
  return <ActiveChatVideoThumbnailInner url={url} onPress={onPress} onLongPress={onLongPress} />;
});

class VideoViewSafeGuard extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error) {
    // Silencia erros de player liberado
  }
  render() {
    if (this.state.hasError) {
      return (
        <View
          style={[
            this.props.fallbackStyle || {
              width: "100%",
              height: "100%",
              backgroundColor: "#18181b"
            }
          ]}
        />
      );
    }
    return this.props.children;
  }
}

function ActiveChatVideoThumbnailInner({ url, onPress, onLongPress }) {
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const player = useVideoPlayer(url || "", (p) => {
    p.loop = true;
    p.muted = true;
    try {
      Promise.resolve(p.play()).catch(() => {});
    } catch (e) {}
  });

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={200}
      style={{
        width: 230,
        height: 230,
        borderRadius: 16,
        overflow: "hidden",
        backgroundColor: "#18181b",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.08)",
        position: "relative"
      }}
    >
      {isMountedRef.current && player ? (
        <VideoViewSafeGuard fallbackStyle={{ width: "100%", height: "100%", backgroundColor: "#18181b" }}>
          <VideoView
            key={url}
            player={player}
            nativeControls={false}
            contentFit="cover"
            style={{ width: "100%", height: "100%" }}
          />
        </VideoViewSafeGuard>
      ) : (
        <View style={{ width: "100%", height: "100%", backgroundColor: "#18181b" }} />
      )}
      <View
        pointerEvents="none"
        style={{
          ...StyleSheet.absoluteFillObject,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0, 0, 0, 0.25)"
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: "rgba(0, 0, 0, 0.65)",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.35)",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 4
          }}
        >
          <Feather name="play" size={22} color="#FFFFFF" style={{ marginLeft: 3 }} />
        </View>
      </View>
      <View
        style={{
          position: "absolute",
          bottom: 8,
          right: 8,
          backgroundColor: "rgba(0, 0, 0, 0.75)",
          paddingHorizontal: 7,
          paddingVertical: 2,
          borderRadius: 8,
          flexDirection: "row",
          alignItems: "center",
          gap: 4
        }}
      >
        <Feather name="video" size={11} color="#FFFFFF" />
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 10,
            fontFamily: "Poppins_600SemiBold"
          }}
        >
          Vídeo
        </Text>
      </View>
    </Pressable>
  );
}

export const GroupChatTab = React.forwardRef(function GroupChatTab(
  {
    groupId,
    group,
    user,
    colors: propColors,
    targetMessageId,
    onTargetReached,
    onOpenProfile,
    onShowToast,
    onShowAlert
  },
  ref
) {
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      try {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      } catch (_) {}
      setKeyboardHeight(e?.endCoordinates?.height || 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      try {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      } catch (_) {}
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const { isDark: themeIsDark, mode, colors: themeColors } = useTheme();
  const colors = propColors || themeColors;
  const isDark = Boolean(
    themeIsDark ||
    mode === "dark" ||
    mode === "oled" ||
    colors?.mode === "dark"
  );

  const [messages, setMessages] = useState(() => ChatCache.getMessagesSync(groupId) || []);
  const [loading, setLoading] = useState(() => !(ChatCache.getMessagesSync(groupId)?.length > 0));
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    setAudioRecordingActive(isRecording);
    return () => {
      setAudioRecordingActive(false);
    };
  }, [isRecording]);

  const [recordSeconds, setRecordSeconds] = useState(0);
  const [audioUri, setAudioUri] = useState(null);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [isViewOnce, setIsViewOnce] = useState(false);
  const [recording, setRecording] = useState(null);
  const recordingRef = useRef(null);
  const recordIntervalRef = useRef(null);
  const [stickerPickerVisible, setStickerPickerVisible] = useState(false);
  const [createStickerVisible, setCreateStickerVisible] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [showGoldBenefitsModal, setShowGoldBenefitsModal] = useState(false);
  const [isMeSpeaking, setIsMeSpeaking] = useState(false);
  const [activeSpeakers, setActiveSpeakers] = useState([]);
  const [viewerMedia, setViewerMedia] = useState(null);
  const [firstUnreadGroupId, setFirstUnreadGroupId] = useState(null);
  const groupInitialScrollDoneRef = useRef(false);

  const isUserGold = Boolean(
    user?.badge_type === "GOLD" ||
    user?.badge_type === "GOLD_VERIFIED" ||
    user?.badgeType === "GOLD" ||
    user?.is_gold ||
    user?.isGold ||
    user?.is_vip ||
    user?.badge === "GOLD"
  );

  const isAnySpeakerActive = activeSpeakers.length > 0 || isMeSpeaking;

  const getSpeakersSubtitle = () => {
    if (activeSpeakers.length === 0) {
      return isMeSpeaking
        ? "Você ao vivo (Falando...)"
        : "Toque para falar ao vivo na tribo";
    }
    const formatted = activeSpeakers.map((s) =>
      String(s.id || s.userId) === String(user?.id)
        ? "Você"
        : s.name || s.username || "Membro"
    );
    if (formatted.length === 1) {
      return `${formatted[0]} ao vivo (Falando...)`;
    }
    if (formatted.length === 2) {
      return `${formatted[0]} e ${formatted[1]} ao vivo (Falando...)`;
    }
    return `${formatted[0]}, ${formatted[1]} e mais ${formatted.length - 2} ao vivo (Falando...)`;
  };

  const handleToggleLiveVoice = async () => {
    if (!isMeSpeaking) {
      if (!isUserGold) {
        setInternalAlert({
          visible: true,
          title: "Recurso Exclusivo VIP",
          message: "A transmissão de voz ao vivo é permitida apenas para membros com Selo Dourado.",
          type: "warning",
          primaryText: "Entendido",
          onPrimaryPress: () => setInternalAlert((prev) => ({ ...prev, visible: false }))
        });
        return;
      }
      const socket = getChatSocket();
      if (!socket) return;
      await setLiveVoiceAudioMode(true).catch(() => {});
      setIsMeSpeaking(true);
      socket.emit("group-live-voice-start", {
        room: groupId,
        groupId,
        userId: user?.id,
        user: {
          id: user?.id,
          name: user?.name,
          username: user?.username,
          avatar_url: user?.avatar_url,
          badge_type: user?.badge_type
        }
      });

      liveVoiceStreamer.startStreaming({
        groupId,
        user: {
          id: user?.id,
          name: user?.name,
          username: user?.username,
          avatar_url: user?.avatar_url
        },
        socket,
        onError: (err) => {
          console.warn("[LIVE VOICE ERROR]:", err);
          handleToggleLiveVoice();
        }
      });
    } else {
      const socket = getChatSocket();
      if (socket) {
        socket.emit("group-live-voice-stop", {
          room: groupId,
          groupId,
          userId: user?.id
        });
      }
      liveVoiceStreamer.stopStreaming();
      setIsMeSpeaking(false);
      await setLiveVoiceAudioMode(false).catch(() => {});
    }
  };

  const [internalAlert, setInternalAlert] = useState({
    visible: false,
    title: "",
    message: "",
    type: "info",
    primaryText: "Entendido",
    onPrimaryPress: null,
    secondaryText: null,
    onSecondaryPress: null
  });

  const [contextSheet, setContextSheet] = useState({ visible: false, message: null });
  const [deleteConfirm, setDeleteConfirm] = useState({ visible: false, mode: "me", message: null });
  const [modernToast, setModernToast] = useState({ visible: false, message: "", type: "success" });

  const isGroupAdmin = Boolean(
    group?.creator_id === user?.id ||
    group?.creatorId === user?.id ||
    group?.is_admin ||
    group?.isAdmin ||
    group?.role === "admin" ||
    group?.role === "creator" ||
    group?.role === "owner"
  );

  const flatListRef = useRef(null);
  const isBanned = Boolean(group?.is_banned || group?.isBanned);

  const loadMessages = useCallback(async () => {
    try {
      NativeOptimization.enableHighRefreshRate().catch(() => {});
      const cached = ChatCache.getMessagesSync(groupId);
      if (cached && cached.length > 0) {
        setMessages(cached);
      } else {
        setLoading(true);
      }
      const res = await api.groups.messages(groupId);
      let rawMsgs = Array.isArray(res) ? res : res?.messages || res?.data || [];
      const clearedTimestamp = await getClearedChatTimestamp(groupId);
      let list = filterClearedMessages(rawMsgs, clearedTimestamp);
      const expiredIds = await getExpiredMessageIds(groupId);
      list = sanitizeMessagesWithExpiration(list, expiredIds);

      list.sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt));
      setMessages(list);
      ChatCache.setMessagesSync(groupId, list);

      const lastReadTimeStr = await AsyncStorage.getItem(`@tribo_group_last_read_${groupId}`);
      if (!groupInitialScrollDoneRef.current && lastReadTimeStr) {
        const lastReadTime = new Date(lastReadTimeStr).getTime();
        const unreadMsgs = list.filter((m) => {
          const isSenderMe = [
            m.userId,
            m.user_id,
            m.user?.id,
            m.sender?.id,
            m.author?.id
          ].some((id) => String(id) === String(user?.id));
          const msgTime = new Date(m.createdAt || m.created_at || 0).getTime();
          return !isSenderMe && msgTime > lastReadTime;
        });

        if (unreadMsgs.length > 0) {
          const oldestUnread = unreadMsgs[unreadMsgs.length - 1];
          const oldestUnreadId = String(oldestUnread.id || oldestUnread._id);
          const oldestUnreadIdx = list.findIndex((m) => String(m.id || m._id) === oldestUnreadId);

          if (oldestUnreadIdx > 0) {
            setFirstUnreadGroupId(oldestUnreadId);
            groupInitialScrollDoneRef.current = true;
            setTimeout(() => {
              try {
                flatListRef.current?.scrollToIndex({
                  index: oldestUnreadIdx,
                  animated: true,
                  viewPosition: 0.5
                });
              } catch (e) {
                flatListRef.current?.scrollToOffset({
                  offset: oldestUnreadIdx * 75,
                  animated: true
                });
              }
            }, 250);
          }
        }
      }

      AsyncStorage.setItem(`@tribo_group_last_read_${groupId}`, new Date().toISOString()).catch(() => {});
      AsyncStorage.setItem(`@tribo_unread_count_${groupId}`, "0").catch(() => {});
    } catch (err) {
      console.warn("Erro ao carregar mensagens do grupo:", err);
    } finally {
      setLoading(false);
    }
  }, [groupId, user?.id]);

  useImperativeHandle(ref, () => ({
    scrollToBottom: () => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    },
    clearMessagesLocally: () => {
      setMessages([]);
    },
    loadMessages,
    exportChat: async () => {
      try {
        const fileUri = await exportChatHistory(groupId, group?.name || "Grupo");
        if (fileUri) {
          onShowToast?.("Conversa exportada com sucesso!");
        }
      } catch (e) {
        onShowAlert?.({
          title: "Erro",
          message: "Não foi possível exportar a conversa.",
          type: "error"
        });
      }
    },
    clearChat: async () => {
      await clearChatHistory(groupId);
      setMessages([]);
      ChatCache.setMessagesSync(groupId, []);
      onShowToast?.("Histórico de mensagens limpo com sucesso!");
    }
  }));

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    const socket = getChatSocket();
    if (!socket) return;

    socket.emit("join_group", groupId);
    socket.emit("join-room", groupId);
    socket.emit("join-group", groupId);
    socket.emit("join-room", `group_${groupId}`);

    const handleNewMessage = (msg) => {
      if (!msg) return;
      const msgGroupId = String(msg.groupId || msg.group_id || "");
      if (msgGroupId === String(groupId) || !msgGroupId) {
        const msgId = String(msg.id || msg._id || "");
        const tempId = msg.tempId || msg.temp_id;
        const senderId = String(msg.userId || msg.user_id || msg.user?.id || msg.sender?.id || "");
        const isFromMe = senderId === String(user?.id);

        setMessages((prev) => {
          const existingIdx = msgId
            ? prev.findIndex((m) => String(m.id || m._id) === msgId)
            : -1;

          if (existingIdx >= 0) {
            const updated = [...prev];
            updated[existingIdx] = { ...updated[existingIdx], ...msg, is_sending: false };
            ChatCache.setMessagesSync(groupId, updated);
            return updated;
          }

          let pendingIdx = -1;
          if (tempId) {
            pendingIdx = prev.findIndex((m) => m.tempId === tempId || m.id === tempId || m._id === tempId);
          }
          if (pendingIdx < 0 && isFromMe) {
            pendingIdx = prev.findIndex((m) => {
              const isPending = String(m.id).startsWith("temp_") || m.is_sending === true || m.sending === true;
              if (!isPending) return false;
              const isMsgAudio =
                Boolean(msg.audio_url || msg.audioUrl) ||
                msg.media_type === "AUDIO" ||
                msg.mediaType === "AUDIO";
              const isMAudio =
                Boolean(m.audio_url || m.audioUrl) ||
                m.media_type === "AUDIO" ||
                m.mediaType === "AUDIO" ||
                String(m.id).startsWith("temp_audio_");
              if (isMsgAudio && isMAudio) {
                return true;
              }
              const isMsgSticker =
                msg.media_type === "STICKER" ||
                msg.mediaType === "STICKER" ||
                Boolean(msg.sticker_id || msg.stickerId);
              const isMSticker =
                m.media_type === "STICKER" ||
                m.mediaType === "STICKER" ||
                Boolean(m.sticker_id || m.stickerId) ||
                String(m.id).startsWith("temp_stk_");
              if (isMsgSticker && isMSticker) {
                return true;
              }
              const msgMedia = msg.media_url || msg.mediaUrl || msg.audio_url || msg.audioUrl;
              const mMedia = m.media_url || m.mediaUrl || m.audio_url || m.audioUrl;
              if (msgMedia && mMedia && (msgMedia === mMedia || msgMedia.includes(mMedia) || mMedia.includes(msgMedia))) {
                return true;
              }
              if (msg.content && m.content && msg.content.trim() === m.content.trim()) {
                return true;
              }
              return false;
            });
          }

          let updated;
          if (pendingIdx >= 0) {
            updated = [...prev];
            updated[pendingIdx] = { ...updated[pendingIdx], ...msg, id: msgId || updated[pendingIdx].id, is_sending: false };
          } else {
            updated = [msg, ...prev];
          }

          ChatCache.setMessagesSync(groupId, updated);
          return updated;
        });
      }
    };

    const handleActiveSpeakersUpdated = (payload) => {
      if (String(payload?.room || payload?.groupId) === String(groupId)) {
        const speakers = Array.isArray(payload.speakers) ? payload.speakers : [];
        setActiveSpeakers(speakers);
        const amISpeaking = speakers.some((s) => String(s.id || s.userId) === String(user?.id));
        if (amISpeaking && !isMeSpeaking) {
          setIsMeSpeaking(true);
        } else if (!amISpeaking && isMeSpeaking) {
          setIsMeSpeaking(false);
          liveVoiceStreamer.stopStreaming();
        }
      }
    };

    const handleUserStartedSpeaking = (payload) => {
      if (String(payload?.room || payload?.groupId) === String(groupId)) {
        const spk = payload.user || { id: payload.userId, name: payload.userName };
        setActiveSpeakers((prev) => {
          const exists = prev.some((s) => String(s.id || s.userId) === String(spk.id || spk.userId));
          if (exists) return prev;
          return [...prev, spk];
        });
        if (String(payload.userId || spk.id) === String(user?.id)) {
          setIsMeSpeaking(true);
        }
      }
    };

    const handleUserStoppedSpeaking = (payload) => {
      if (String(payload?.room || payload?.groupId) === String(groupId)) {
        const targetId = String(payload.userId || payload.user?.id);
        setActiveSpeakers((prev) => prev.filter((s) => String(s.id || s.userId) !== targetId));
        if (targetId === String(user?.id)) {
          setIsMeSpeaking(false);
          liveVoiceStreamer.stopStreaming();
        }
      }
    };

    const handleLiveVoiceStopped = (payload) => {
      if (String(payload?.room || payload?.groupId) === String(groupId)) {
        setActiveSpeakers([]);
        setIsMeSpeaking(false);
        liveVoiceStreamer.stopStreaming();
      }
    };

    const handleLiveVoiceChunk = async (payload) => {
      if (String(payload?.room || payload?.groupId) === String(groupId)) {
        liveVoiceStreamer.playChunk(payload, user?.id);
      }
    };

    const handleMessageDeleted = (payload) => {
      const targetId = String(payload?.messageId || payload?.id);
      if (targetId) {
        setMessages((prev) => {
          const updated = prev.map((m) =>
            String(m.id || m._id) === targetId
              ? {
                  ...m,
                  is_deleted: true,
                  isDeleted: true,
                  deleted_for_everyone: true,
                  deletedForEveryone: true,
                  content: "Esta mensagem foi apagada",
                  media_type: null,
                  mediaType: null,
                  media_url: null,
                  mediaUrl: null,
                  audio_url: null,
                  audioUrl: null,
                  video_url: null,
                  videoUrl: null
                }
              : m
          );
          ChatCache.setMessagesSync(groupId, updated);
          return updated;
        });
      }
    };

    socket.on("group_message", handleNewMessage);
    socket.on("group-message", handleNewMessage);
    socket.on("receive-message", handleNewMessage);
    socket.on("new_message", handleNewMessage);
    socket.on("active-speakers-updated", handleActiveSpeakersUpdated);
    socket.on("user-started-speaking", handleUserStartedSpeaking);
    socket.on("user-stopped-speaking", handleUserStoppedSpeaking);
    socket.on("group-live-voice-started", handleActiveSpeakersUpdated);
    socket.on("group-live-voice-stopped", handleLiveVoiceStopped);
    socket.on("group-live-voice-chunk", handleLiveVoiceChunk);
    socket.on("group-message-deleted", handleMessageDeleted);
    socket.on("message-deleted", handleMessageDeleted);

    socket.emit("get-active-speakers", { room: groupId, groupId });

    return () => {
      liveVoiceStreamer.stopStreaming();
      socket.off("group_message", handleNewMessage);
      socket.off("group-message", handleNewMessage);
      socket.off("receive-message", handleNewMessage);
      socket.off("new_message", handleNewMessage);
      socket.off("active-speakers-updated", handleActiveSpeakersUpdated);
      socket.off("user-started-speaking", handleUserStartedSpeaking);
      socket.off("user-stopped-speaking", handleUserStoppedSpeaking);
      socket.off("group-live-voice-started", handleActiveSpeakersUpdated);
      socket.off("group-live-voice-stopped", handleLiveVoiceStopped);
      socket.off("group-live-voice-chunk", handleLiveVoiceChunk);
      socket.off("group-message-deleted", handleMessageDeleted);
      socket.off("message-deleted", handleMessageDeleted);
      socket.emit("leave_group", groupId);
    };
  }, [groupId, user?.id]);

  const showInternalAlert = ({
    title,
    message,
    type = "info",
    primaryText = "Entendido",
    onPrimaryPress = null,
    secondaryText = null,
    onSecondaryPress = null
  }) => {
    setInternalAlert({
      visible: true,
      title,
      message,
      type,
      primaryText,
      onPrimaryPress,
      secondaryText,
      onSecondaryPress
    });
  };

  const handleOpenContextMenu = (item) => {
    if (!item || item.is_deleted || item.deleted_for_everyone) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch (e) {}
    setContextSheet({ visible: true, message: item });
  };

  const handleSaveMedia = async (msg, mediaType) => {
    const url = msg?.media_url || msg?.mediaUrl || msg?.video_url || msg?.url;
    if (!url) return;
    try {
      const res = await saveMediaToGallery({ url, type: mediaType });
      setModernToast({
        visible: true,
        message: res.message || "Mídia salva na galeria com sucesso!",
        type: "success"
      });
    } catch (err) {
      showInternalAlert({
        title: "Erro ao Salvar",
        message: err.message || "Não foi possível salvar a mídia na galeria.",
        type: "error"
      });
    }
  };

  const handleSaveSticker = async (msg) => {
    const url = msg?.media_url || msg?.mediaUrl || msg?.video_url || msg?.url;
    const stickerId = msg?.sticker_id || msg?.stickerId || msg?.id;
    if (!url) return;
    try {
      await saveStickerToInventory({
        id: stickerId,
        sticker_id: stickerId,
        video_url: url,
        media_url: url,
        sticker_name: msg?.sticker_name || msg?.stickerName || "Figurinha de Vídeo",
        pack_name: msg?.pack_name || msg?.packName || "Gerais",
        author_name: msg?.author_name || msg?.authorName || "Tribo",
        description: msg?.description || null
      });
      setModernToast({
        visible: true,
        message: "Figurinha adicionada aos favoritos!",
        type: "success"
      });
    } catch (err) {
      showInternalAlert({
        title: "Erro",
        message: "Não foi possível salvar a figurinha no inventário.",
        type: "error"
      });
    }
  };

  const handleExecuteDelete = async () => {
    const { mode, message: msg } = deleteConfirm;
    const msgId = msg?.id || msg?._id;
    setDeleteConfirm({ visible: false, mode: "me", message: null });
    if (!msgId) return;

    if (mode === "me") {
      setMessages((prev) => {
        const updated = prev.filter(
          (m) => String(m.id || m._id) !== String(msgId)
        );
        ChatCache.setMessagesSync(groupId, updated);
        return updated;
      });
      setModernToast({
        visible: true,
        message: "Mensagem apagada para você.",
        type: "info"
      });
      api.groups
        .deleteChatMessage(groupId, msgId, { forEveryone: false, type: "me" })
        .catch((err) => {
          console.warn("Erro ao apagar para mim:", err);
        });
    } else {
      setMessages((prev) => {
        const updated = prev.map((m) =>
          String(m.id || m._id) === String(msgId)
            ? {
                ...m,
                is_deleted: true,
                isDeleted: true,
                deleted_for_everyone: true,
                deletedForEveryone: true,
                content: "Esta mensagem foi apagada",
                media_type: null,
                mediaType: null,
                media_url: null,
                mediaUrl: null,
                audio_url: null,
                audioUrl: null,
                video_url: null,
                videoUrl: null
              }
            : m
        );
        ChatCache.setMessagesSync(groupId, updated);
        return updated;
      });
      setModernToast({
        visible: true,
        message: "Mensagem apagada para todos.",
        type: "info"
      });

      try {
        const socket = getChatSocket();
        if (socket) {
          socket.emit("group-message-deleted", {
            groupId: String(groupId),
            messageId: msgId,
            forEveryone: true
          });
          socket.emit("delete-message", {
            room: String(groupId),
            messageId: msgId,
            forEveryone: true
          });
        }
      } catch (e) {}

      api.groups
        .deleteChatMessage(groupId, msgId, {
          forEveryone: true,
          type: "everyone"
        })
        .catch((err) => {
          console.warn("Erro ao apagar para todos:", err);
        });
    }
  };

  const handleExpireMessage = (expiredMsgId) => {
    markMessageAsExpired(groupId, expiredMsgId);
    setMessages((prev) =>
      prev.map((m) =>
        String(m.id || m._id) === String(expiredMsgId)
          ? {
              ...m,
              is_deleted: true,
              isDeleted: true,
              content: "[Mídia temporária expirada]"
            }
          : m
      )
    );
  };

  const handleSwipeToReply = (msg) => {
    if (isBanned) return;
    setReplyingTo(msg);
  };

  const handleScrollToQuotedMessage = (quotedMsgId) => {
    if (!quotedMsgId) return;
    const targetIdStr = String(quotedMsgId);
    const targetIndex = messages.findIndex(
      (m) => String(m.id || m._id) === targetIdStr
    );

    if (targetIndex !== -1 && flatListRef.current) {
      flatListRef.current.scrollToIndex({
        index: targetIndex,
        animated: true,
        viewPosition: 0.5
      });
      setHighlightedMessageId(targetIdStr);
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 1500);
    }
  };

  const handleSendSticker = async (sticker) => {
    if (isBanned) return;
    const stickerUrl =
      sticker?.video_url ||
      sticker?.videoUrl ||
      sticker?.media_url ||
      sticker?.mediaUrl ||
      sticker?.url;
    const stickerId = sticker?.id || sticker?.sticker_id || sticker?.stickerId;
    const stickerName = sticker?.sticker_name || sticker?.stickerName || "Figurinha";
    const packName = sticker?.pack_name || sticker?.packName || "Gerais";

    if (!stickerUrl) return;

    const replyIdToSend = replyingTo ? String(replyingTo.id || replyingTo._id) : null;
    const replyContextToSend = replyingTo
      ? {
          id: String(replyingTo.id || replyingTo._id),
          sender_name:
            replyingTo.user?.name ||
            replyingTo.sender?.name ||
            replyingTo.author?.name ||
            "Usuário",
          text_content:
            replyingTo.content ||
            (replyingTo.media_type === "AUDIO" || replyingTo.audio_url
              ? "Mensagem de voz"
              : replyingTo.media_type === "STICKER"
              ? "Figurinha de vídeo"
              : replyingTo.media_type === "VIDEO"
              ? "Vídeo"
              : replyingTo.media_url
              ? "Foto"
              : "Mensagem"),
          media_type:
            replyingTo.media_type ||
            replyingTo.mediaType ||
            (replyingTo.audio_url
              ? "AUDIO"
              : replyingTo.sticker_id
              ? "STICKER"
              : "TEXT"),
          preview_url:
            replyingTo.media_url ||
            replyingTo.mediaUrl ||
            replyingTo.video_url ||
            replyingTo.audio_url ||
            null
        }
      : null;
    const viewOnceToSend = isViewOnce;

    setIsViewOnce(false);
    setReplyingTo(null);
    setStickerPickerVisible(false);
    setCreateStickerVisible(false);

    const tempId = `temp_stk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const optimisticMsg = {
      id: tempId,
      _id: tempId,
      tempId,
      userId: user?.id,
      user: user,
      sender: user,
      author: user,
      content: "",
      media_url: stickerUrl,
      media_type: "STICKER",
      sticker_id: stickerId,
      sticker_name: stickerName,
      pack_name: packName,
      is_view_once: viewOnceToSend,
      reply_to_id: replyIdToSend,
      reply_context: replyContextToSend,
      createdAt: new Date().toISOString(),
      is_sending: true
    };

    setMessages((prev) => {
      const updated = [optimisticMsg, ...prev];
      ChatCache.setMessagesSync(groupId, updated);
      return updated;
    });

    try {
      const payload = {
        groupId,
        content: "",
        media_url: stickerUrl,
        media_type: "STICKER",
        sticker_id: stickerId,
        sticker_name: stickerName,
        pack_name: packName,
        is_view_once: viewOnceToSend,
        reply_to_id: replyIdToSend,
        reply_context: replyContextToSend
      };

      const sentRes = await api.groups.sendMessage(groupId, payload);
      const realMsg = sentRes?.message || sentRes?.data || sentRes;
      const realId = realMsg?.id || realMsg?._id;

      if (realId) {
        setMessages((prev) => {
          const updated = prev.map((m) =>
            m.id === tempId || m._id === tempId
              ? { ...m, ...realMsg, id: realId, _id: realId, is_sending: false }
              : m
          );
          ChatCache.setMessagesSync(groupId, updated);
          return updated;
        });
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId && m._id !== tempId));
      showInternalAlert({
        title: "Erro ao enviar figurinha",
        message: errorMessage(err),
        type: "error"
      });
    }
  };

  const handleSend = async () => {
    if ((!text.trim() && !audioUri && !selectedMedia) || isBanned) return;

    const textToSend = text.trim();
    const mediaToSend = selectedMedia;
    const audioToSend = audioUri;
    const viewOnceToSend = isViewOnce;
    const replyIdToSend = replyingTo ? String(replyingTo.id || replyingTo._id) : null;
    const replyContextToSend = replyingTo
      ? {
          id: String(replyingTo.id || replyingTo._id),
          sender_name:
            replyingTo.user?.name ||
            replyingTo.sender?.name ||
            replyingTo.author?.name ||
            "Usuário",
          text_content:
            replyingTo.content ||
            (replyingTo.media_type === "AUDIO" || replyingTo.audio_url
              ? "Mensagem de voz"
              : replyingTo.media_type === "STICKER"
              ? "Figurinha de vídeo"
              : replyingTo.media_type === "VIDEO"
              ? "Vídeo"
              : replyingTo.media_url
              ? "Foto"
              : "Mensagem"),
          media_type:
            replyingTo.media_type ||
            replyingTo.mediaType ||
            (replyingTo.audio_url
              ? "AUDIO"
              : replyingTo.sticker_id
              ? "STICKER"
              : "TEXT"),
          preview_url:
            replyingTo.media_url ||
            replyingTo.mediaUrl ||
            replyingTo.video_url ||
            replyingTo.audio_url ||
            null
        }
      : null;

    setText("");
    setSelectedMedia(null);
    setAudioUri(null);
    setIsViewOnce(false);
    setReplyingTo(null);

    const tempId = `temp_group_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const optimisticMsg = {
      id: tempId,
      _id: tempId,
      tempId,
      userId: user?.id,
      user: user,
      sender: user,
      author: user,
      content: textToSend,
      media_url: mediaToSend ? mediaToSend.uri || mediaToSend.url : null,
      media_type: audioToSend ? "AUDIO" : mediaToSend ? (mediaToSend.type === "video" ? "VIDEO" : "IMAGE") : "TEXT",
      audio_url: audioToSend || null,
      is_view_once: viewOnceToSend,
      reply_to_id: replyIdToSend,
      reply_context: replyContextToSend,
      createdAt: new Date().toISOString(),
      is_sending: true
    };

    setMessages((prev) => {
      const updated = [optimisticMsg, ...prev];
      ChatCache.setMessagesSync(groupId, updated);
      return updated;
    });

    try {
      let mediaUrl = null;
      let mediaType = "TEXT";
      let uploadedAudioUrl = audioToSend;

      if (audioToSend) {
        try {
          const uploadFn = api.uploads?.audio || api.upload?.audio;
          if (uploadFn) {
            const uploadRes = await uploadFn(audioToSend, "audio.m4a", "audio/m4a");
            uploadedAudioUrl = getUploadUrl(uploadRes) || uploadRes?.url || audioToSend;
          }
        } catch (e) {}
      }

      if (mediaToSend) {
        const rawUri = mediaToSend.url || mediaToSend.uri;
        mediaUrl = rawUri;
        mediaType = mediaToSend.type === "video" ? "VIDEO" : "IMAGE";
        try {
          if (mediaType === "VIDEO" && api.uploads?.video) {
            const uploadRes = await api.uploads.video(rawUri, "video.mp4", "video/mp4");
            mediaUrl = getUploadUrl(uploadRes) || uploadRes?.url || rawUri;
          } else if (api.uploads?.photo) {
            const uploadRes = await api.uploads.photo(rawUri, "photo.jpg", "image/jpeg");
            mediaUrl = getUploadUrl(uploadRes) || uploadRes?.url || rawUri;
          }
        } catch (e) {}
      }

      const payload = {
        groupId,
        content: textToSend,
        media_url: mediaUrl,
        media_type: audioToSend ? "AUDIO" : mediaType,
        audio_url: uploadedAudioUrl,
        is_view_once: viewOnceToSend,
        reply_to_id: replyIdToSend
      };

      const sentRes = await api.groups.sendMessage(groupId, payload);
      const realMsg = sentRes?.message || sentRes?.data || sentRes;
      const realId = realMsg?.id || realMsg?._id;

      if (realId) {
        setMessages((prev) => {
          const updated = prev.map((m) =>
            m.id === tempId || m._id === tempId
              ? { ...m, ...realMsg, id: realId, _id: realId, is_sending: false }
              : m
          );
          ChatCache.setMessagesSync(groupId, updated);
          return updated;
        });
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId && m._id !== tempId));
      showInternalAlert({
        title: "Erro ao enviar",
        message: errorMessage(err),
        type: "error"
      });
    }
  };

  const startRecording = async () => {
    try {
      await setOptimizedAudioMode(true);
      await duckGroupAudio(true);
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        showInternalAlert({
          title: "Permissão Necessária",
          message: "Permita o acesso ao microfone para gravar áudios.",
          type: "info"
        });
        return;
      }
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = newRecording;
      setRecording(newRecording);
      setIsRecording(true);
      setRecordSeconds(0);

      recordIntervalRef.current = setInterval(() => {
        setRecordSeconds((sec) => sec + 1);
      }, 1000);
    } catch (err) {
      console.warn("Erro ao iniciar gravação:", err);
    }
  };

  const cancelRecording = async () => {
    try {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      }
      setRecording(null);
      setIsRecording(false);
      setAudioUri(null);
      setRecordSeconds(0);
      await setOptimizedAudioMode(false);
    } catch (err) {}
  };

  const stopAndSendRecording = async () => {
    try {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();
        recordingRef.current = null;
        setRecording(null);
        setIsRecording(false);
        await setOptimizedAudioMode(false);

        if (uri) {
          const tempMsgId = `temp_audio_${Date.now()}`;
          const replyIdToSend = replyingTo ? String(replyingTo.id || replyingTo._id) : null;
          const replyContextToSend = replyingTo
            ? {
                id: String(replyingTo.id || replyingTo._id),
                sender_name:
                  replyingTo.user?.name ||
                  replyingTo.sender?.name ||
                  replyingTo.author?.name ||
                  "Usuário",
                text_content:
                  replyingTo.content ||
                  (replyingTo.media_type === "AUDIO" || replyingTo.audio_url
                    ? "Mensagem de voz"
                    : replyingTo.media_type === "STICKER"
                    ? "Figurinha de vídeo"
                    : replyingTo.media_type === "VIDEO"
                    ? "Vídeo"
                    : replyingTo.media_url
                    ? "Foto"
                    : "Mensagem"),
                media_type:
                  replyingTo.media_type ||
                  replyingTo.mediaType ||
                  (replyingTo.audio_url
                    ? "AUDIO"
                    : replyingTo.sticker_id
                    ? "STICKER"
                    : "TEXT"),
                preview_url:
                  replyingTo.media_url ||
                  replyingTo.mediaUrl ||
                  replyingTo.video_url ||
                  replyingTo.audio_url ||
                  null
              }
            : null;

          const optimisticMsg = {
            id: tempMsgId,
            _id: tempMsgId,
            userId: user?.id,
            user: user,
            sender: user,
            author: user,
            audio_url: uri,
            audioUrl: uri,
            media_type: "AUDIO",
            mediaType: "AUDIO",
            content: "",
            is_view_once: isViewOnce,
            reply_to_id: replyIdToSend,
            reply_context: replyContextToSend,
            createdAt: new Date().toISOString(),
            is_sending: true
          };

          setMessages((prev) => {
            const updated = [optimisticMsg, ...prev];
            ChatCache.setMessagesSync(groupId, updated);
            return updated;
          });

          const uploadFn =
            api.uploads?.audio ||
            api.upload?.audio ||
            api.uploads?.media ||
            api.upload?.media;

          let finalAudioUrl = uri;
          if (uploadFn) {
            const uploadRes = await uploadFn(
              uri,
              `audio_${Date.now()}.m4a`,
              "audio/m4a"
            );
            finalAudioUrl =
              getUploadUrl(uploadRes) ||
              uploadRes?.url ||
              uploadRes?.secure_url ||
              uploadRes?.audio_url ||
              uri;
          }

          const sentRes = await api.groups.sendMessage(groupId, {
            groupId,
            content: "",
            audio_url: finalAudioUrl,
            media_type: "AUDIO",
            is_view_once: isViewOnce,
            reply_to_id: replyIdToSend,
            reply_context: replyContextToSend
          });

          const realMsg = sentRes?.message || sentRes?.data || sentRes;
          const realId = realMsg?.id || realMsg?._id;

          if (realId) {
            setMessages((prev) => {
              const alreadyHasReal = prev.some(
                (m) =>
                  String(m.id || m._id) === String(realId) &&
                  m.id !== tempMsgId &&
                  m._id !== tempMsgId
              );
              if (alreadyHasReal) {
                const filtered = prev.filter(
                  (m) => m.id !== tempMsgId && m._id !== tempMsgId
                );
                ChatCache.setMessagesSync(groupId, filtered);
                return filtered;
              }
              const updated = prev.map((m) =>
                m.id === tempMsgId || m._id === tempMsgId
                  ? {
                      ...m,
                      ...realMsg,
                      id: realId,
                      _id: realId,
                      is_sending: false,
                      audio_url: finalAudioUrl,
                      audioUrl: finalAudioUrl
                    }
                  : m
              );
              ChatCache.setMessagesSync(groupId, updated);
              return updated;
            });
          }

          setAudioUri(null);
          setIsViewOnce(false);
          setReplyingTo(null);
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.filter((m) => !String(m.id).startsWith("temp_audio_"))
      );
      showInternalAlert({
        title: "Erro ao enviar áudio",
        message: errorMessage(err) || "Não foi possível enviar o áudio.",
        type: "error"
      });
    } finally {
      setIsRecording(false);
      await setOptimizedAudioMode(false);
    }
  };

  const pickMedia = async () => {
    if (isBanned) return;
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.85
      });

      if (res.canceled || !res.assets || !res.assets[0]) return;
      const asset = res.assets[0];
      const isVideo = asset.type === "video" || (asset.uri && asset.uri.toLowerCase().endsWith(".mp4"));
      const tempId = `temp_media_${Date.now()}`;

      const optimisticMsg = {
        id: tempId,
        _id: tempId,
        groupId,
        userId: user?.id,
        user_id: user?.id,
        media_url: asset.uri,
        mediaUrl: asset.uri,
        media_type: isVideo ? "VIDEO" : "IMAGE",
        mediaType: isVideo ? "VIDEO" : "IMAGE",
        content: "",
        is_view_once: isViewOnce,
        isViewOnce,
        createdAt: new Date().toISOString(),
        is_sending: true,
        user: user,
        sender: user
      };

      setMessages((prev) => {
        const updated = [optimisticMsg, ...prev];
        ChatCache.setMessagesSync(groupId, updated);
        return updated;
      });

      let uploadedUrl = asset.uri;
      try {
        if (isVideo && api.uploads?.video) {
          const uploadRes = await api.uploads.video(
            asset.uri,
            "video.mp4",
            "video/mp4"
          );
          uploadedUrl = getUploadUrl(uploadRes) || uploadRes?.url || asset.uri;
        } else if (api.uploads?.photo) {
          const uploadRes = await api.uploads.photo(
            asset.uri,
            "photo.jpg",
            "image/jpeg"
          );
          uploadedUrl = getUploadUrl(uploadRes) || uploadRes?.url || asset.uri;
        }
      } catch (uploadErr) {
        console.warn("Upload fallback de mídia:", uploadErr);
      }

      const payload = {
        groupId,
        content: "",
        media_url: uploadedUrl,
        media_type: isVideo ? "VIDEO" : "IMAGE",
        is_view_once: isViewOnce,
        reply_to_id: replyingTo ? String(replyingTo.id || replyingTo._id) : null
      };

      const sentRes = await api.groups.sendMessage(groupId, payload);
      const realMsg = sentRes?.data || sentRes?.message || sentRes;
      const realId = realMsg?.id || realMsg?._id;

      if (realId) {
        setMessages((prev) => {
          const updated = prev.map((m) =>
            m.id === tempId || m._id === tempId
              ? {
                  ...m,
                  ...realMsg,
                  id: realId,
                  _id: realId,
                  is_sending: false,
                  media_url: uploadedUrl,
                  mediaUrl: uploadedUrl,
                  media_type: isVideo ? "VIDEO" : "IMAGE",
                  mediaType: isVideo ? "VIDEO" : "IMAGE"
                }
              : m
          );
          ChatCache.setMessagesSync(groupId, updated);
          return updated;
        });
      }

      setIsViewOnce(false);
      setReplyingTo(null);
    } catch (err) {
      setMessages((prev) =>
        prev.filter((m) => !String(m.id).startsWith("temp_media_"))
      );
      showInternalAlert({
        title: "Erro ao enviar mídia",
        message: errorMessage(err) || "Não foi possível enviar a mídia selecionada.",
        type: "error"
      });
    }
  };

  const buildReplyContext = (originalMsg) => {
    if (!originalMsg) return { reply_context: null };
    const originalAuthor =
      originalMsg.user?.name ||
      originalMsg.user?.username ||
      originalMsg.sender?.name ||
      originalMsg.sender?.username ||
      "Usuário";
    const originalContent =
      originalMsg.content ||
      (originalMsg.media_type === "AUDIO" ? "Mensagem de áudio" : "Mídia compartilhada");
    return {
      reply_context: {
        id: originalMsg.id || originalMsg._id,
        author: originalAuthor,
        content: originalContent,
        media_type: originalMsg.media_type,
        media_url: originalMsg.media_url
      }
    };
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
      {/* Barra de Voz ao Vivo (Discreta, Compacta e Moderna) */}
      <View style={{ alignItems: "center", marginVertical: 4, paddingHorizontal: 12 }}>
        <Pressable
          onPress={handleToggleLiveVoice}
          style={({ pressed }) => [
            {
              backgroundColor: isMeSpeaking
                ? "rgba(239, 68, 68, 0.18)"
                : isAnySpeakerActive
                ? "rgba(245, 158, 11, 0.18)"
                : "rgba(24, 24, 27, 0.85)",
              borderRadius: 20,
              borderWidth: 1,
              borderColor: isMeSpeaking
                ? "rgba(239, 68, 68, 0.4)"
                : isAnySpeakerActive
                ? "rgba(245, 158, 11, 0.4)"
                : "rgba(255, 255, 255, 0.08)",
              paddingHorizontal: 12,
              paddingVertical: 5,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              opacity: pressed ? 0.85 : 1,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 4,
              elevation: 2
            }
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons
              name={isMeSpeaking ? "mic" : "radio"}
              size={14}
              color={isMeSpeaking ? "#ef4444" : isAnySpeakerActive ? "#f59e0b" : "#e4e4e7"}
            />
            <Text
              style={{
                color: isMeSpeaking ? "#f87171" : isAnySpeakerActive ? "#fbbf24" : "#e4e4e7",
                fontSize: 11.5,
                fontFamily: "Poppins_600SemiBold"
              }}
            >
              {isMeSpeaking
                ? "Você está ao vivo"
                : isAnySpeakerActive
                ? getSpeakersSubtitle()
                : "Voz ao Vivo"}
            </Text>
            {isAnySpeakerActive && !isMeSpeaking && (
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#22c55e" }} />
            )}
          </View>

          <View
            style={{
              backgroundColor: isMeSpeaking ? "#ef4444" : "#f59e0b",
              borderRadius: 12,
              paddingHorizontal: 8,
              paddingVertical: 2,
              flexDirection: "row",
              alignItems: "center",
              gap: 3
            }}
          >
            <Feather
              name={isMeSpeaking ? "mic-off" : "mic"}
              size={11}
              color="#000000"
            />
            <Text
              style={{
                color: "#000000",
                fontSize: 10.5,
                fontFamily: "Poppins_700Bold"
              }}
            >
              {isMeSpeaking ? "Sair" : "Falar"}
            </Text>
          </View>
        </Pressable>
      </View>

      {loading && messages.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#0284c7" />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          inverted
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          keyExtractor={(i) => String(i.id || i._id)}
          contentContainerStyle={{ paddingBottom: 8, paddingTop: 8 }}
          onScroll={notifyChatScroll}
          scrollEventThrottle={16}
          renderItem={({ item, index }) => {
            const isMe = [
              item.userId,
              item.user_id,
              item.user?.id,
              item.sender?.id,
              item.author?.id
            ].some((id) => String(id) === String(user?.id));

            const authorName =
              item.user?.name ||
              item.user?.username ||
              item.author?.name ||
              item.author?.username ||
              item.sender?.name ||
              item.sender?.username ||
              "Usuário";

            const isDeleted = Boolean(
              item.is_deleted ||
              item.isDeleted ||
              item.deleted_for_everyone ||
              item.deletedForEveryone
            );

            const handleLongPress = () => {
              handleOpenContextMenu(item);
            };

            let timeStr = "";
            try {
              const dt = new Date(item.createdAt || item.created_at);
              if (!isNaN(dt.getTime())) {
                timeStr = dt.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit"
                });
              }
            } catch (e) {}

            let resolvedReplyContext = item.reply_context || item.replyContext;
            if (!resolvedReplyContext && (item.reply_to_id || item.replyToId)) {
              const targetId = String(item.reply_to_id || item.replyToId);
              const original = messages.find(
                (m) => String(m.id || m._id) === targetId
              );
              if (original) {
                resolvedReplyContext = buildReplyContext(original).reply_context;
              }
            }

            const prevItem = messages[index + 1];
            const nextItem = messages[index - 1];

            const getSenderId = (m) =>
              String(
                m?.userId ||
                m?.user?.id ||
                m?.sender?.id ||
                m?.user?._id ||
                m?.author?.id ||
                ""
              );
            const currentSenderId = getSenderId(item);

            const isSameSenderAsPrev = Boolean(
              prevItem && getSenderId(prevItem) === currentSenderId
            );
            const isSameSenderAsNext = Boolean(
              nextItem && getSenderId(nextItem) === currentSenderId
            );

            const currTime = new Date(item.createdAt || item.created_at || 0).getTime();
            const prevTime = prevItem
              ? new Date(prevItem.createdAt || prevItem.created_at || 0).getTime()
              : 0;
            const nextTime = nextItem
              ? new Date(nextItem.createdAt || nextItem.created_at || 0).getTime()
              : 0;

            const isWithinTimeWithPrev =
              isSameSenderAsPrev && Math.abs(currTime - prevTime) < 120000;
            const isWithinTimeWithNext =
              isSameSenderAsNext && Math.abs(currTime - nextTime) < 120000;

            const isFirstInCluster = !isWithinTimeWithPrev;
            const isLastInCluster = !isWithinTimeWithNext;

            const isSticker = !isDeleted && Boolean(
              item.media_type === "STICKER" ||
              item.mediaType === "STICKER" ||
              item.type === "STICKER" ||
              item.sticker_id ||
              item.stickerId
            );
            const isViewOnce = !isDeleted && Boolean(item.is_view_once || item.isViewOnce);
            const isBorderlessMedia = !isDeleted && (isSticker || isViewOnce);
            const isAudio = !isDeleted && Boolean(item.audio_url || item.audioUrl);

            let isReelShare =
              item.media_type === "REEL_SHARE" ||
              item.media_type === "reel_share" ||
              item.mediaType === "REEL_SHARE" ||
              item.type === "reel_share";
            let reelData = null;
            if (item.content) {
              if (typeof item.content === "object" && item.content !== null) {
                if (item.content.video_id || item.content.videoId || item.content.youtube_video_id) {
                  reelData = item.content;
                  isReelShare = true;
                }
              } else if (typeof item.content === "string") {
                const trimmed = item.content.trim();
                if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
                  try {
                    const parsed = JSON.parse(trimmed);
                    if (parsed && (parsed.video_id || parsed.videoId || parsed.youtube_video_id || parsed.thumbnail_url)) {
                      reelData = parsed;
                      isReelShare = true;
                    }
                  } catch (e) {}
                }
              }
            }

            const isMediaOnly = Boolean(
              (item.media_url || item.mediaUrl) &&
              !item.audio_url &&
              !item.audioUrl &&
              !item.content?.trim() &&
              !resolvedReplyContext
            );

            const bubbleBg = isMe
              ? isAudio
                ? "#1e293b"
                : colors.primary || "#0284c7"
              : "#18181b";

            const bubbleBorderColor = isMe ? "transparent" : "#27272a";
            const isFirstUnread = String(item.id || item._id) === String(firstUnreadGroupId);

            return (
              <View key={String(item.id || item._id)}>
                {isFirstUnread && (
                  <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 12, paddingHorizontal: 16 }}>
                    <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.12)" }} />
                    <View style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: colors.primary || "#0284c7",
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      borderRadius: 14,
                      marginHorizontal: 8,
                      elevation: 3
                    }}>
                      <Feather name="bell" size={11} color="#ffffff" style={{ marginRight: 5 }} />
                      <Text style={{ color: "#ffffff", fontSize: 11, fontFamily: "Poppins_600SemiBold" }}>Novas Mensagens Não Lidas</Text>
                    </View>
                    <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.12)" }} />
                  </View>
                )}
                <SwipeableMessageRow
                  item={item}
                  onSwipeToReply={handleSwipeToReply}
                  isHighlighted={highlightedMessageId === String(item.id || item._id)}
                  disabled={isBanned}
                >
                  <Pressable
                    onLongPress={handleLongPress}
                    style={{
                      width: "100%",
                      opacity: isDeleted ? 0.6 : 1,
                      marginTop: isFirstInCluster ? 6 : 2,
                      marginBottom: isLastInCluster ? 4 : 2,
                      paddingHorizontal: 12
                    }}
                  >
                    {isMe ? (
                      <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "flex-end" }}>
                        <View style={{ alignItems: "flex-end", maxWidth: isBorderlessMedia ? undefined : "82%", minWidth: resolvedReplyContext ? 220 : undefined }}>
                          {isBorderlessMedia ? (
                            <View style={{ borderRadius: 22 }}>
                              {isViewOnce ? (
                                item.media_type === "STICKER" || item.mediaType === "STICKER" ? (
                                  <ViewOnceStickerMessage item={item} isMe={true} onExpire={handleExpireMessage} />
                                ) : item.audio_url || item.audioUrl ? (
                                  <ViewOnceAudioPlayer item={item} isMe={true} onExpire={handleExpireMessage} />
                                ) : (
                                  <ViewOnceMediaCard item={item} isMe={true} onExpire={handleExpireMessage} groupId={groupId} currentUser={user} />
                                )
                              ) : (
                                <VideoStickerMessage item={item} isMe={true} currentUser={user} onLongPress={handleLongPress} onDelete={handleLongPress} />
                              )}
                            </View>
                          ) : (
                            <View
                              style={{
                                backgroundColor: isMediaOnly ? "transparent" : bubbleBg,
                                borderRadius: 16,
                                borderTopLeftRadius: 16,
                                borderBottomLeftRadius: 16,
                                borderTopRightRadius: isFirstInCluster ? 16 : 4,
                                borderBottomRightRadius: isLastInCluster ? 4 : 4,
                                paddingHorizontal: isMediaOnly ? 0 : 14,
                                paddingVertical: isMediaOnly ? 0 : 9,
                                borderWidth: isMediaOnly ? 0 : 1,
                                borderColor: isMediaOnly ? "transparent" : bubbleBorderColor,
                                elevation: isMediaOnly ? 0 : 2,
                                width: resolvedReplyContext ? "100%" : undefined,
                                minWidth: resolvedReplyContext ? 220 : undefined
                              }}
                            >
                              {Boolean(resolvedReplyContext) && (
                                <QuotedMessageBlock replyContext={resolvedReplyContext} isMe={true} onPress={handleScrollToQuotedMessage} />
                              )}

                              {isDeleted ? (
                                <Text style={{ color: "#a1a1aa", fontStyle: "italic", fontSize: 13 }}>
                                  <Feather name="slash" size={12} color="#a1a1aa" /> Mensagem apagada
                                </Text>
                              ) : (
                                <>
                                  {Boolean(item.audio_url || item.audioUrl) && (
                                    <AudioMessagePlayer audioUrl={item.audio_url || item.audioUrl} isMe={true} />
                                  )}
                                  {Boolean(item.media_url || item.mediaUrl) && !item.audio_url && !item.audioUrl && (
                                    item.media_type === "VIDEO" || String(item.media_url || item.mediaUrl).toLowerCase().endsWith(".mp4") ? (
                                      <ChatVideoThumbnail
                                        url={item.media_url || item.mediaUrl}
                                        onPress={() => setViewerMedia({ url: item.media_url || item.mediaUrl, type: "video", user: item.user, message: item })}
                                        onLongPress={handleLongPress}
                                      />
                                    ) : (
                                      <Pressable
                                        onPress={() => setViewerMedia({ url: item.media_url || item.mediaUrl, type: "image", user: item.user, message: item })}
                                        onLongPress={handleLongPress}
                                      >
                                        <Image
                                          source={{ uri: item.media_url || item.mediaUrl }}
                                          style={{ width: 230, height: 230, borderRadius: 12, backgroundColor: "#1c1917" }}
                                          resizeMode="cover"
                                        />
                                      </Pressable>
                                    )
                                  )}

                                  {isReelShare && reelData && (
                                    <ReelShareCard reelData={reelData} isMe={true} />
                                  )}

                                  {Boolean(item.content) && !isReelShare && (
                                    <View style={{ flexDirection: "row", alignItems: "flex-end", flexWrap: "wrap" }}>
                                      <Text style={{ color: "#ffffff", fontSize: 14.5, fontFamily: "Poppins_400Regular", lineHeight: 20 }}>
                                        {item.content}
                                      </Text>
                                      {Boolean(timeStr) && (
                                        <Text style={{ color: "rgba(255, 255, 255, 0.75)", fontSize: 10, fontFamily: "Poppins_400Regular", marginLeft: "auto", paddingLeft: 10, paddingTop: 2 }}>
                                          {timeStr}
                                        </Text>
                                      )}
                                    </View>
                                  )}
                                </>
                              )}
                            </View>
                          )}
                        </View>
                      </View>
                    ) : (
                      <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
                        <Pressable onPress={() => onOpenProfile?.(item.user || item.sender)} style={{ marginRight: 8, marginBottom: 2 }}>
                          <Avatar url={item.user?.avatar_url || item.user?.avatarUrl} size={30} fallback={authorName} />
                        </Pressable>
                        <View style={{ alignItems: "flex-start", maxWidth: isBorderlessMedia ? undefined : "82%", minWidth: resolvedReplyContext ? 220 : undefined }}>
                          {isFirstInCluster && (
                            <Text style={{ color: "#a1a1aa", fontSize: 11, fontFamily: "Poppins_600SemiBold", marginLeft: 4, marginBottom: 3 }}>
                              {authorName}
                            </Text>
                          )}
                          {isBorderlessMedia ? (
                            <View style={{ borderRadius: 22 }}>
                              {isViewOnce ? (
                                item.media_type === "STICKER" || item.mediaType === "STICKER" ? (
                                  <ViewOnceStickerMessage item={item} isMe={false} onExpire={handleExpireMessage} />
                                ) : item.audio_url || item.audioUrl ? (
                                  <ViewOnceAudioPlayer item={item} isMe={false} onExpire={handleExpireMessage} />
                                ) : (
                                  <ViewOnceMediaCard item={item} isMe={false} onExpire={handleExpireMessage} groupId={groupId} currentUser={user} />
                                )
                              ) : (
                                <VideoStickerMessage item={item} isMe={false} currentUser={user} onLongPress={handleLongPress} onDelete={handleLongPress} />
                              )}
                            </View>
                          ) : (
                            <View
                              style={{
                                backgroundColor: isMediaOnly ? "transparent" : bubbleBg,
                                borderRadius: 16,
                                borderTopRightRadius: 16,
                                borderBottomRightRadius: 16,
                                borderTopLeftRadius: isFirstInCluster ? 16 : 4,
                                borderBottomLeftRadius: isLastInCluster ? 4 : 4,
                                paddingHorizontal: isMediaOnly ? 0 : 14,
                                paddingVertical: isMediaOnly ? 0 : 9,
                                borderWidth: isMediaOnly ? 0 : 1,
                                borderColor: isMediaOnly ? "transparent" : bubbleBorderColor,
                                elevation: isMediaOnly ? 0 : 2,
                                width: resolvedReplyContext ? "100%" : undefined,
                                minWidth: resolvedReplyContext ? 220 : undefined
                              }}
                            >
                              {Boolean(resolvedReplyContext) && (
                                <QuotedMessageBlock replyContext={resolvedReplyContext} isMe={false} onPress={handleScrollToQuotedMessage} />
                              )}

                              {isDeleted ? (
                                <Text style={{ color: "#71717a", fontStyle: "italic", fontSize: 13 }}>
                                  <Feather name="slash" size={12} color="#71717a" /> Mensagem apagada
                                </Text>
                              ) : (
                                <>
                                  {Boolean(item.audio_url || item.audioUrl) && (
                                    <AudioMessagePlayer audioUrl={item.audio_url || item.audioUrl} isMe={false} />
                                  )}
                                  {Boolean(item.media_url || item.mediaUrl) && !item.audio_url && !item.audioUrl && (
                                    item.media_type === "VIDEO" || String(item.media_url || item.mediaUrl).toLowerCase().endsWith(".mp4") ? (
                                      <ChatVideoThumbnail
                                        url={item.media_url || item.mediaUrl}
                                        onPress={() => setViewerMedia({ url: item.media_url || item.mediaUrl, type: "video", user: item.user, message: item })}
                                        onLongPress={handleLongPress}
                                      />
                                    ) : (
                                      <Pressable
                                        onPress={() => setViewerMedia({ url: item.media_url || item.mediaUrl, type: "image", user: item.user, message: item })}
                                        onLongPress={handleLongPress}
                                      >
                                        <Image
                                          source={{ uri: item.media_url || item.mediaUrl }}
                                          style={{ width: 230, height: 230, borderRadius: 12, backgroundColor: "#1c1917" }}
                                          resizeMode="cover"
                                        />
                                      </Pressable>
                                    )
                                  )}

                                  {isReelShare && reelData && (
                                    <ReelShareCard reelData={reelData} isMe={false} />
                                  )}

                                  {Boolean(item.content) && !isReelShare && (
                                    <View style={{ flexDirection: "row", alignItems: "flex-end", flexWrap: "wrap" }}>
                                      <Text style={{ color: "#f4f4f5", fontSize: 14.5, fontFamily: "Poppins_400Regular", lineHeight: 20 }}>
                                        {item.content}
                                      </Text>
                                      {Boolean(timeStr) && (
                                        <Text style={{ color: "#a1a1aa", fontSize: 10, fontFamily: "Poppins_400Regular", marginLeft: "auto", paddingLeft: 10, paddingTop: 2 }}>
                                          {timeStr}
                                        </Text>
                                      )}
                                    </View>
                                  )}
                                </>
                              )}
                            </View>
                          )}
                        </View>
                      </View>
                    )}
                  </Pressable>
                </SwipeableMessageRow>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={{ color: "#71717a", textAlign: "center", marginTop: 40, fontFamily: "Poppins_400Regular" }}>
              Nenhuma mensagem nesta conversa ainda.
            </Text>
          }
        />
      )}

      {isBanned ? (
        <View style={{ padding: 14, backgroundColor: "rgba(239, 68, 68, 0.15)", borderTopWidth: 1, borderColor: "rgba(239, 68, 68, 0.3)", alignItems: "center" }}>
          <Text style={{ color: "#ef4444", fontFamily: "Poppins_600SemiBold", fontSize: 13 }}>
            Esta tribo está suspensa para envio de mensagens.
          </Text>
        </View>
      ) : (
        <View
          style={{
            paddingHorizontal: 12,
            paddingTop: 6,
            paddingBottom: keyboardHeight > 0 ? keyboardHeight + 8 : Math.max(insets.bottom, 12),
            backgroundColor: "#000000",
            borderTopWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.08)",
            flexDirection: "row",
            alignItems: "flex-end",
            gap: 8
          }}
        >
          {Boolean(replyingTo) && (
            <ReplyPreviewBar replyingTo={replyingTo} onCancelReply={() => setReplyingTo(null)} />
          )}

          {isRecording ? (
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#18181b",
                borderRadius: 26,
                paddingHorizontal: 14,
                paddingVertical: 8,
                minHeight: 50,
                borderWidth: 1,
                borderColor: "#ef4444"
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#ef4444" }} />
                <Text style={{ color: "#ef4444", fontFamily: "Poppins_600SemiBold", fontSize: 14 }}>
                  {formatAudioTime(recordSeconds * 1000)}
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Pressable onPress={cancelRecording} style={{ padding: 6 }}>
                  <Feather name="trash-2" size={18} color="#ef4444" />
                </Pressable>
                <Pressable
                  onPress={stopAndSendRecording}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: colors.primary || "#0284c7",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Feather name="send" size={16} color="#ffffff" style={{ marginLeft: -1, marginTop: 1 }} />
                </Pressable>
              </View>
            </View>
          ) : audioUri ? (
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#18181b",
                borderRadius: 28,
                borderWidth: 1,
                borderColor: "#27272a",
                paddingHorizontal: 16,
                minHeight: 52
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#0c4a6e", alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                  <Feather name="mic" size={16} color="#0284c7" />
                </View>
                <Text style={{ color: "#f4f4f5", fontFamily: "Poppins_500Medium", fontSize: 14 }}>
                  Áudio gravado ({recordSeconds}s)
                </Text>
              </View>
              <Pressable onPress={cancelRecording} style={{ padding: 8, borderRadius: 18, backgroundColor: "rgba(239, 68, 68, 0.12)" }}>
                <Feather name="trash-2" size={18} color="#ef4444" />
              </Pressable>
            </View>
          ) : (
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#1e1e24",
                borderRadius: 26,
                borderWidth: 1,
                borderColor: "#2f2f38",
                paddingHorizontal: 10,
                minHeight: 50,
                elevation: 2
              }}
            >
              <Pressable onPress={pickMedia} style={{ padding: 6, borderRadius: 14 }} accessibilityLabel="Anexar imagem">
                <Feather name="image" size={21} color={colors.primary || "#0284c7"} />
              </Pressable>
              <Pressable onPress={() => setStickerPickerVisible(true)} style={{ padding: 6, borderRadius: 14 }} accessibilityLabel="Figurinhas da Tribo">
                <MaterialCommunityIcons name="sticker-emoji" size={22} color={colors.primary || "#0284c7"} />
              </Pressable>
              <Pressable
                onPress={() => setIsViewOnce((prev) => !prev)}
                style={{
                  padding: 6,
                  borderRadius: 14,
                  backgroundColor: isViewOnce ? "rgba(139, 92, 246, 0.18)" : "transparent"
                }}
                accessibilityLabel="Visualização única"
              >
                <MaterialCommunityIcons
                  name={isViewOnce ? "numeric-1-circle" : "numeric-1-circle-outline"}
                  size={22}
                  color={isViewOnce ? "#a855f7" : "#71717a"}
                />
              </Pressable>
              <TextInput
                placeholder="Digite uma mensagem..."
                placeholderTextColor="#71717a"
                value={text}
                onChangeText={setText}
                style={{
                  flex: 1,
                  color: "#f4f4f5",
                  fontFamily: "Poppins_400Regular",
                  fontSize: 14.5,
                  maxHeight: 120,
                  paddingVertical: 6,
                  paddingHorizontal: 4
                }}
                multiline
              />
              {!text.trim() && !selectedMedia && (
                <Pressable onPress={startRecording} style={{ padding: 7, borderRadius: 18 }} accessibilityLabel="Gravar áudio">
                  <Feather name="mic" size={21} color={colors.primary || "#0284c7"} />
                </Pressable>
              )}
            </View>
          )}

          {!isRecording && (
            <Pressable
              onPress={handleSend}
              disabled={!text.trim() && !audioUri && !selectedMedia}
              style={({ pressed }) => [
                {
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  backgroundColor:
                    !text.trim() && !audioUri && !selectedMedia
                      ? "#333"
                      : colors.primary || "#0284c7",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.85 : 1,
                  elevation: !text.trim() && !audioUri && !selectedMedia ? 0 : 4
                }
              ]}
              accessibilityLabel="Enviar mensagem"
            >
              <Feather
                name="send"
                size={20}
                color={!text.trim() && !audioUri && !selectedMedia ? "#71717a" : "#ffffff"}
                style={{ marginLeft: -1, marginTop: 1 }}
              />
            </Pressable>
          )}
        </View>
      )}

      <MediaContextMenuSheet
        visible={contextSheet.visible}
        message={contextSheet.message}
        currentUser={user}
        isGroupAdmin={isGroupAdmin}
        onReply={(msg) => handleSwipeToReply(msg)}
        onSaveToGallery={(msg, type) => handleSaveMedia(msg, type)}
        onSaveSticker={(msg) => handleSaveSticker(msg)}
        onDeleteForMe={(msg) => setDeleteConfirm({ visible: true, mode: "me", message: msg })}
        onDeleteForEveryone={(msg) => setDeleteConfirm({ visible: true, mode: "everyone", message: msg })}
        onClose={() => setContextSheet({ visible: false, message: null })}
      />

      <ConfirmDeleteModal
        visible={deleteConfirm.visible}
        mode={deleteConfirm.mode}
        onConfirm={handleExecuteDelete}
        onCancel={() => setDeleteConfirm({ visible: false, mode: "me", message: null })}
      />

      <TriboModernToast
        visible={modernToast.visible}
        message={modernToast.message}
        type={modernToast.type}
        onHide={() => setModernToast({ visible: false, message: "", type: "success" })}
      />

      <StickerPickerModal
        visible={stickerPickerVisible}
        onClose={() => setStickerPickerVisible(false)}
        onSelectSticker={handleSendSticker}
        onOpenCreateModal={() => {
          if (!isUserGold) {
            setShowGoldBenefitsModal(true);
          } else {
            setCreateStickerVisible(true);
          }
        }}
        currentUser={user}
      />

      <GoldBadgeBenefitsModal
        visible={showGoldBenefitsModal}
        onClose={() => setShowGoldBenefitsModal(false)}
      />

      <CreateVideoStickerModal
        visible={createStickerVisible}
        onClose={() => setCreateStickerVisible(false)}
        onStickerCreated={handleSendSticker}
        currentUser={user}
        onShowGoldModal={() => setShowGoldBenefitsModal(true)}
      />

      <CustomModal
        visible={internalAlert.visible}
        type={internalAlert.type}
        title={internalAlert.title}
        message={internalAlert.message}
        primaryText={internalAlert.primaryText}
        onPrimaryPress={() => {
          if (internalAlert.onPrimaryPress) internalAlert.onPrimaryPress();
          setInternalAlert((prev) => ({ ...prev, visible: false }));
        }}
        secondaryText={internalAlert.secondaryText}
        onSecondaryPress={() => {
          if (internalAlert.onSecondaryPress) internalAlert.onSecondaryPress();
          setInternalAlert((prev) => ({ ...prev, visible: false }));
        }}
        onClose={() => setInternalAlert((prev) => ({ ...prev, visible: false }))}
      />

      <MediaViewerModal
        visible={Boolean(viewerMedia)}
        media={viewerMedia}
        onDelete={(media) => {
          setViewerMedia(null);
          if (media?.message) {
            handleOpenContextMenu(media.message);
          }
        }}
        onClose={() => setViewerMedia(null)}
      />
    </View>
  );
});






