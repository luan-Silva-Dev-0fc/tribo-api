import React, { useState } from 'react';
import { View, StyleSheet, ToastAndroid, Alert, Platform } from 'react-native';
import { useGroupAudioSync } from '../hooks/useGroupAudioSync';
import { GroupAudioHeaderPlayer } from '../components/GroupAudioHeaderPlayer';
import { GroupAudioQueueBottomSheet } from '../components/GroupAudioQueueBottomSheet';
import { SelectTrackModal } from '../components/SelectTrackModal';

/**
 * Exemplo de como integrar o Player e a Fila no GroupDetailsScreen ou tela de Chat do Grupo
 */
export function GroupChatAudioIntegration({ groupId, userToken, currentUser, socket, children }) {
  const [queueVisible, setQueueVisible] = useState(false);
  const [selectModalVisible, setSelectModalVisible] = useState(false);

  const showError = (msg) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(msg, ToastAndroid.SHORT);
    } else {
      Alert.alert('Aviso', msg);
    }
  };

  const {
    audioState,
    isGold,
    isMuted,
    localProgressMs,
    play,
    pause,
    skip,
    addToQueue,
    removeFromQueue,
    toggleMute
  } = useGroupAudioSync({
    socket,
    groupId,
    currentUser,
    onPermissionError: showError
  });

  return (
    <View style={styles.container}>
      {/* 1. Mini-Player Fixo no Topo do Chat (abaixo da AppBar) */}
      <GroupAudioHeaderPlayer
        currentTrack={audioState.current_track}
        isPlaying={audioState.is_playing}
        isGold={isGold}
        isMuted={isMuted}
        progressMs={localProgressMs}
        queueCount={audioState.queue_list?.length || 0}
        onPlay={play}
        onPause={pause}
        onSkip={skip}
        onToggleMute={toggleMute}
        onOpenQueue={() => setQueueVisible(true)}
      />

      {/* Conteúdo Normal do Grupo (Mensagens/Feed) */}
      {children}

      {/* 2. BottomSheet da Fila Compartilhada */}
      <GroupAudioQueueBottomSheet
        visible={queueVisible}
        onClose={() => setQueueVisible(false)}
        currentTrack={audioState.current_track}
        queueList={audioState.queue_list || []}
        isPlaying={audioState.is_playing}
        isGold={isGold}
        progressMs={localProgressMs}
        onPlay={play}
        onPause={pause}
        onSkip={skip}
        onRemoveTrack={removeFromQueue}
        onOpenAddModal={() => {
          setQueueVisible(false);
          setSelectModalVisible(true);
        }}
      />

      {/* 3. Modal Seletor de Músicas da Galeria */}
      <SelectTrackModal
        visible={selectModalVisible}
        token={userToken}
        onClose={() => setSelectModalVisible(false)}
        onSelectTrack={(track) => {
          addToQueue(track);
          setQueueVisible(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000'
  }
});
