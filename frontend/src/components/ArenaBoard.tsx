import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "@/src/theme";

type Dot = { x: number; y: number };

const HOME: Dot[] = [
  { x: 6, y: 50 }, // GK
  { x: 22, y: 28 },
  { x: 22, y: 72 },
  { x: 38, y: 50 },
  { x: 44, y: 34 },
  { x: 44, y: 66 },
];
const AWAY: Dot[] = [
  { x: 94, y: 50 }, // GK
  { x: 78, y: 28 },
  { x: 78, y: 72 },
  { x: 62, y: 50 },
  { x: 56, y: 34 },
  { x: 56, y: 66 },
];

// A tactics board that reads specifically as BOARDED 6-a-side ARENA soccer:
// rounded-corner boards (no straight outdoor sidelines), a tight pitch, goals set
// into the end boards, and 6 players a side (incl. keeper).
export function ArenaBoard({ homeColor = colors.green, awayColor = colors.blue }: { homeColor?: string; awayColor?: string }) {
  return (
    <View style={styles.wrap} testID="arena-board">
      <View style={styles.turf}>
        {/* boards highlight ring */}
        <View style={styles.boards} pointerEvents="none" />
        {/* center line + circle */}
        <View style={styles.centerLine} />
        <View style={styles.centerCircle} />
        <View style={styles.centerSpot} />
        {/* goals set into the end boards */}
        <View style={[styles.goal, styles.goalLeft]} />
        <View style={[styles.goal, styles.goalRight]} />
        {/* keeper creases (arena arcs) */}
        <View style={[styles.crease, styles.creaseLeft]} />
        <View style={[styles.crease, styles.creaseRight]} />
        {/* players */}
        {HOME.map((d, i) => (
          <Marker key={`h${i}`} x={d.x} y={d.y} color={homeColor} keeper={i === 0} />
        ))}
        {AWAY.map((d, i) => (
          <Marker key={`a${i}`} x={d.x} y={d.y} color={awayColor} keeper={i === 0} />
        ))}
      </View>
      <View style={styles.legend}>
        <Legend color={homeColor} label="6 v 6 · incl. keeper" />
        <Text style={styles.legendNote}>Boards keep the ball live</Text>
      </View>
    </View>
  );
}

function Marker({ x, y, color, keeper }: { x: number; y: number; color: string; keeper?: boolean }) {
  return (
    <View style={[styles.marker, { left: `${x}%`, top: `${y}%`, borderColor: keeper ? colors.white : color, backgroundColor: keeper ? "transparent" : color }]}>
      {keeper ? <Text style={styles.gk}>GK</Text> : null}
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const LINE = "rgba(255,255,255,0.35)";

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  turf: {
    aspectRatio: 1.7,
    backgroundColor: "#0C2A1A",
    borderRadius: 28,
    borderWidth: 4,
    borderColor: "#20402F",
    overflow: "hidden",
  },
  boards: {
    position: "absolute",
    top: 6, left: 6, right: 6, bottom: 6,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: LINE,
  },
  centerLine: { position: "absolute", left: "50%", top: 6, bottom: 6, width: 1.5, backgroundColor: LINE },
  centerCircle: {
    position: "absolute", left: "50%", top: "50%", width: 70, height: 70, borderRadius: 35,
    borderWidth: 1.5, borderColor: LINE, marginLeft: -35, marginTop: -35,
  },
  centerSpot: { position: "absolute", left: "50%", top: "50%", width: 5, height: 5, borderRadius: 3, backgroundColor: LINE, marginLeft: -2.5, marginTop: -2.5 },
  goal: { position: "absolute", top: "50%", width: 6, height: 34, marginTop: -17, backgroundColor: colors.white, opacity: 0.9 },
  goalLeft: { left: 2, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  goalRight: { right: 2, borderTopLeftRadius: 3, borderBottomLeftRadius: 3 },
  crease: { position: "absolute", top: "50%", width: 46, height: 76, marginTop: -38, borderColor: LINE, borderWidth: 1.5 },
  creaseLeft: { left: -30, borderRadius: 40 },
  creaseRight: { right: -30, borderRadius: 40 },
  marker: {
    position: "absolute", width: 18, height: 18, borderRadius: 9, borderWidth: 2,
    marginLeft: -9, marginTop: -9, alignItems: "center", justifyContent: "center",
  },
  gk: { color: colors.white, fontFamily: fonts.display, fontSize: 8, fontWeight: "800" },
  legend: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12 },
  legendNote: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 11, fontStyle: "italic" },
});
