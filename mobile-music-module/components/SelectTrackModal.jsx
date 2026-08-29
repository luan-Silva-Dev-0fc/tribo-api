import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { trackApi } from '../services/trackApi';

export function SelectTrackModal({ visible, token, onClose, onSelectTrack }) {
  const [tracks, setTracks] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadTracks(search);
    }
  }, [visible, search]);

  const loadTracks = async (term) => {
    setLoading(true);
    try {
      const data = await trackApi.listMyTracks(term, token);
      setTracks(data);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Selecionar Música da Galeria</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#8E8E93" />
            </TouchableOpacity>
          </View>

          {/* Busca */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#8E8E93" />
            <TextInput
              style={styles.input}
              placeholder="Buscar título ou artista..."
              placeholderTextColor="#636366"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {/* Lista */}
          {loading ? (
            <ActivityIndicator size="large" color="#FFB800" style={{ marginTop: 40 }} />
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
                >
                  <View style={styles.iconBox}>
                    <Ionicons name="musical-note" size={20} color="#FFB800" />
                  </View>
                  <View style={styles.trackInfo}>
                    <Text numberOfLines={1} style={styles.trackTitle}>{item.title}</Text>
                    <Text numberOfLines={1} style={styles.trackArtist}>{item.artist}</Text>
                  </View>
                  <Ionicons name="add-circle" size={24} color="#FFB800" />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>Nenhuma música encontrada na sua galeria.</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end'
  },
  content: {
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    height: '75%',
    borderTopWidth: 1,
    borderTopColor: '#1F1F1F'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  title: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700'
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 14,
    height: 42,
    borderWidth: 1,
    borderColor: '#242424'
  },
  input: {
    color: '#FFFFFF',
    flex: 1,
    marginLeft: 8,
    fontSize: 14
  },
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: '#1F1F1F'
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#1F1A00',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  trackInfo: {
    flex: 1
  },
  trackTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700'
  },
  trackArtist: {
    color: '#8E8E93',
    fontSize: 13,
    marginTop: 2
  },
  emptyText: {
    color: '#636366',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14
  }
});
