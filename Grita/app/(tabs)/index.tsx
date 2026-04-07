import React, { useState, useEffect } from "react";
import { StyleSheet, View, Text } from "react-native";
import { WebView } from "react-native-webview";
import { Audio } from "expo-av";

export default function App() {
  const [note, setNote] = useState("--");
  const [hz, setHz] = useState("0");

  useEffect(() => {
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      if (status === "granted") {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
      }
    })();
  }, []);

  const getNoteFromHz = (freq: number) => {
    if (freq < 30) return "--";
    const notes = [
      "DO",
      "DO#",
      "RE",
      "RE#",
      "MI",
      "FA",
      "FA#",
      "SOL",
      "SOL#",
      "LA",
      "LA#",
      "SI",
    ];
    const midi = Math.round(12 * (Math.log(freq / 440) / Math.log(2)) + 69);
    const noteName = notes[midi % 12];
    const octave = Math.floor(midi / 12) - 1;
    return `${noteName}${octave}`;
  };

  // Presta atención al cierre de este template string con ` abajo
  const htmlAnalyzer = `
    <html>
      <body style="background-color: black;">
        <script>
          async function start() {
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              const ctx = new (window.AudioContext || window.webkitAudioContext)();
              const src = ctx.createMediaStreamSource(stream);
              const ans = ctx.createAnalyser();
              ans.fftSize = 2048;
              src.connect(ans);
              const buf = new Float32Array(ans.fftSize);
              function detect() {
                ans.getFloatTimeDomainData(buf);
                let p = autoCorrelate(buf, ctx.sampleRate);
                if (p !== -1) window.ReactNativeWebView.postMessage(p.toFixed(2));
                requestAnimationFrame(detect);
              }
              function autoCorrelate(b, s) {
                let L = b.length, r = 0;
                for (let i=0; i<L; i++) r += b[i]*b[i];
                if (Math.sqrt(r/L) < 0.015) return -1;
                let c = new Array(L).fill(0);
                for (let i=0; i<L; i++) for (let j=0; j<L-i; j++) c[i] += b[j]*b[j+i];
                let d = 0; while (c[d] > c[d+1]) d++;
                let mVal = -1, mPos = -1;
                for (let i=d; i<L; i++) { if (c[i] > mVal) { mVal = c[i]; mPos = i; } }
                return s / mPos;
              }
              detect();
            } catch (e) { window.ReactNativeWebView.postMessage("ERR"); }
          }
          setTimeout(start, 500);
        </script>
      </body>
    </html>
  `;

  const handleMessage = (e: any) => {
    const frequency = parseFloat(e.nativeEvent.data);
    if (!isNaN(frequency)) {
      setHz(Math.round(frequency).toString());
      setNote(getNoteFromHz(frequency));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Nota detectada</Text>
      <View style={styles.noteContainer}>
        <Text style={styles.noteText}>{note}</Text>
      </View>
      <Text style={styles.hzText}>{hz} Hz</Text>
      <View style={styles.hidden}>
        <WebView
          source={{ html: htmlAnalyzer, baseUrl: "https://localhost" }}
          onMessage={handleMessage}
          onPermissionRequest={(e) => e.grant()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    color: "#555",
    fontSize: 16,
  },
  noteContainer: {
    marginVertical: 20,
    padding: 30,
    borderRadius: 20,
    backgroundColor: "#111",
    borderWidth: 2,
    borderColor: "#0f0",
  },
  noteText: {
    color: "#0f0",
    fontSize: 70,
    fontWeight: "bold",
  },
  hzText: {
    color: "#fff",
    fontSize: 20,
    opacity: 0.5,
  },
  hidden: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },
});
