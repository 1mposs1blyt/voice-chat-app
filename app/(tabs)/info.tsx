import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, SafeAreaView } from 'react-native';
import { RTCPeerConnection, mediaDevices, RTCSessionDescription, MediaStream } from 'react-native-webrtc';
import Zeroconf from 'react-native-zeroconf';
import dgram from 'react-native-udp';
import { Buffer } from 'buffer';
import "../global.css"; // Твои стили NativeWind

const UDP_PORT = 12345;
const SERVICE_TYPE = 'moto-intercom';

export default function InfoScreen() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<string[]>([]);
  const [isTalking, setIsTalking] = useState(false);
  const [status, setStatus] = useState('Инициализация...');

  const socket = useRef<any>(null);
  const zeroconf = useRef(new Zeroconf());
  const pcs = useRef<{ [key: string]: RTCPeerConnection }>({});

  useEffect(() => {
    initVoiceSystem();
    return () => {
      zeroconf.current.stop();
      socket.current?.close();
      Object.values(pcs.current).forEach(pc => pc.close());
    };
  }, []);

  const initVoiceSystem = async () => {
    try {
      // 1. Настройка микрофона с шумоподавлением для мотоцикла
      const stream = await mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false
      });
      stream.getAudioTracks()[0].enabled = false; // По умолчанию микрофон выключен (PTT)
      setLocalStream(stream);

      // 2. UDP Сокет для обмена сигналами напрямую
      socket.current = dgram.createSocket('udp4');
      socket.current.bind(UDP_PORT);
      socket.current.on('message', (msg: Buffer, rinfo: any) => {
        const data = JSON.parse(msg.toString());
        handleSignaling(data, rinfo.address, stream);
      });

      // 3. Поиск устройств в локальной сети (Wi-Fi/Hotspot)
      setupDiscovery();
      setStatus('В сети. Ищем участников...');
    } catch (e) {
      setStatus('Ошибка: проверьте разрешения');
      console.error(e);
    }
  };

  const setupDiscovery = () => {
    const name = `Biker-${Math.random().toString(36).substring(7)}`;
    zeroconf.current.registerService(SERVICE_TYPE, 'udp', 'local.', name, UDP_PORT);
    zeroconf.current.scan(SERVICE_TYPE, 'udp', 'local.');

    zeroconf.current.on('resolved', (service) => {
      if (service.addresses && service.addresses[0]) {
        const ip = service.addresses[0];
        // Не звоним сами себе
        if (!peers.includes(ip)) {
          setPeers(prev => [...new Set([...prev, ip])]);
          createConnection(ip);
        }
      }
    });
  };

  const createConnection = async (remoteIp: string) => {
    if (pcs.current[remoteIp]) return;

    const pc = new RTCPeerConnection({ iceServers: [] });
    pcs.current[remoteIp] = pc;

    // Добавляем наш голос в поток для этого участника
    localStream?.getTracks().forEach(track => pc.addTrack(track, localStream!));

    const offer = await pc.createOffer({});
    await pc.setLocalDescription(offer);

    sendSignal({ type: 'OFFER', sdp: offer }, remoteIp);
  };

  const handleSignaling = async (data: any, remoteIp: string, stream: MediaStream) => {
    let pc = pcs.current[remoteIp];

    if (!pc) {
      pc = new RTCPeerConnection({ iceServers: [] });
      pcs.current[remoteIp] = pc;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      pc.ontrack = () => {}; // Звук начнет играть автоматически через WebRTC
    }

    if (data.type === 'OFFER') {
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal({ type: 'ANSWER', sdp: answer }, remoteIp);
    } else if (data.type === 'ANSWER') {
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    }
  };

  const sendSignal = (data: any, ip: string) => {
    const message = JSON.stringify(data);
    socket.current.send(message, 0, message.length, UDP_PORT, ip);
  };

  const toggleTalk = (active: boolean) => {
    if (localStream) {
      localStream.getAudioTracks()[0].enabled = active;
      setIsTalking(active);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-950 p-6">
      <View className="items-center mb-8">
        <Text className="text-white text-3xl font-bold">Intercom</Text>
        <Text className="text-slate-400 mt-2">{status}</Text>
      </View>

      <View className="flex-1 bg-slate-900/50 rounded-3xl p-4 mb-6 border border-slate-800">
        <Text className="text-slate-500 font-semibold mb-4 uppercase text-xs tracking-widest">
          Участники поблизости ({peers.length})
        </Text>
        <FlatList 
          data={peers}
          keyExtractor={item => item}
          renderItem={({item}) => (
            <View className="flex-row items-center bg-slate-800/50 p-3 rounded-xl mb-2 border border-slate-700/50">
              <View className="w-2 h-2 rounded-full bg-emerald-500 mr-3" />
              <Text className="text-slate-200 font-medium">Biker @ {item}</Text>
            </View>
          )}
        />
      </View>

      <View className="items-center justify-center pb-10">
        <TouchableOpacity 
          activeOpacity={0.8}
          onPressIn={() => toggleTalk(true)}
          onPressOut={() => toggleTalk(false)}
          className={`w-48 h-48 rounded-full items-center justify-center border-8 
            ${isTalking ? 'bg-red-600 border-red-500 shadow-2xl shadow-red-500/50' : 'bg-slate-800 border-slate-700'}`}
        >
          <Text className="text-white text-4xl font-black">
            {isTalking ? 'LIVE' : 'PTT'}
          </Text>
          <Text className="text-white/60 text-xs mt-2 font-bold uppercase tracking-tighter">
            Push to talk
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}