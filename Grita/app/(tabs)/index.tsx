import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, View, Text, Dimensions } from "react-native";
import { WebView } from "react-native-webview";
import { Audio } from "expo-av";

const { width } = Dimensions.get("window");

export default function App() {
  const [note, setNote] = useState("--");
  const [hz, setHz] = useState("0");
  const [color, setColor] = useState("#555");

  const lastNoteRef = useRef("--");
  const countRef = useRef(0);
  const STABILITY_THRESHOLD = 3;

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

  const processTuning = (freq: number) => {
    if (freq < 40) return { name: "--", color: "#555" };

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

    // Cálculo de la nota y la desviación (cents)
    const midi = 12 * (Math.log(freq / 440) / Math.log(2)) + 69;
    const midiRounded = Math.round(midi);
    const cents = (midi - midiRounded) * 100; // Qué tan desafinado está (-50 a 50)

    const noteName = notes[midiRounded % 12];
    const octave = Math.floor(midiRounded / 12) - 1;

    // Lógica de colores según afinación
    let statusColor = "#FF3B30"; // Rojo (Muy desafinado)
    if (Math.abs(cents) < 12) {
      statusColor = "#00FF66"; // Verde (Afinado)
    } else if (Math.abs(cents) < 30) {
      statusColor = "#FFCC00"; // Amarillo/Naranja (Cerca)
    }

    return {
      name: `${noteName}${octave}`,
      color: statusColor,
      cents: cents.toFixed(0),
    };
  };

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
              ans.fftSize = 4096; // Mayor resolución
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
                if (Math.sqrt(r/L) < 0.02) return -1;
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
      const result = processTuning(frequency);

      if (result.name === lastNoteRef.current) {
        countRef.current += 1;
      } else {
        lastNoteRef.current = result.name;
        countRef.current = 0;
      }

      if (countRef.current >= STABILITY_THRESHOLD) {
        setHz(Math.round(frequency).toString());
        setNote(result.name);
        setColor(result.color);
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.mainTitle}>AFINADOR DE VOZ</Text>

      <View style={[styles.circle, { borderColor: color, shadowColor: color }]}>
        <Text
          style={[styles.noteText, { color: color }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {note}
        </Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.hzText}>{hz} Hz</Text>
        <Text style={[styles.statusText, { color: color }]}>
          {note === "--"
            ? "SILENCIO"
            : color === "#00FF66"
              ? "AFINADO"
              : "DESAFINADO"}
        </Text>
      </View>

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
    backgroundColor: "#050505",
    alignItems: "center",
    justifyContent: "center",
  },
  mainTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 5,
    marginBottom: 50,
    opacity: 0.7,
  },
  circle: {
    width: width * 0.65, // Tamaño basado en el ancho de pantalla
    height: width * 0.65,
    borderRadius: (width * 0.65) / 2,
    backgroundColor: "#111",
    borderWidth: 6,
    justifyContent: "center",
    alignItems: "center",
    padding: 20, // Espacio interno para que no toque bordes
    elevation: 25,
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  noteText: {
    fontSize: 80, // Tamaño máximo, bajará si el texto es largo
    fontWeight: "900",
    textAlign: "center",
    width: "100%",
  },
  infoBox: {
    marginTop: 50,
    alignItems: "center",
  },
  hzText: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "200",
  },
  statusText: {
    fontSize: 14,
    marginTop: 10,
    fontWeight: "bold",
    letterSpacing: 2,
  },
  hidden: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },
});
