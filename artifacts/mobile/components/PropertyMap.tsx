import MapView, { Marker } from "react-native-maps";
import type { StyleProp, ViewStyle } from "react-native";

export function PropertyMap({ latitude, longitude, title, style }: { latitude: number; longitude: number; title: string; style?: StyleProp<ViewStyle> }) {
  return (
    <MapView style={style} initialRegion={{ latitude, longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 }} scrollEnabled={false}>
      <Marker coordinate={{ latitude, longitude }} title={title} />
    </MapView>
  );
}
