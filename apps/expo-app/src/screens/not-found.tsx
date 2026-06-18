import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { useColors } from "@/hooks/use-color";
import { withAlpha } from "@/lib/theme";
import config from "@root/app.config";
import { Link, Stack } from "expo-router";
import { TouchableOpacity, View } from "react-native";

const updateVersion = String(config.extra?.updateVersion ?? "N/A");

export default function NotFound() {
  const colors = useColors();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        className="flex-1 bg-background justify-center items-center px-8"
        style={{ backgroundColor: colors.background }}
      >
        <View className="grid w-full gap-4">
          <Label>Input</Label>
          <Input placeholder="Type something..." className="w-full" />
        </View>
        <Button variant="outline">
          <Text>Submit</Text>
        </Button>
        {/* 404 Illustration */}
        <View className="mb-10 relative w-full h-64 justify-center items-center">
          {/* Background Circles */}
          <View
            className="absolute w-56 h-56 rounded-full opacity-30"
            style={{ backgroundColor: colors.muted }}
          />
          <View
            className="absolute w-40 h-40 rounded-full opacity-20"
            style={{ backgroundColor: colors.accent }}
          />

          {/* Large 404 Text */}
          <View className="absolute">
            <Text
              className="text-9xl font-bold"
              style={{ color: withAlpha(colors.foreground, 0.12) }}
            >
              404
            </Text>
          </View>

          {/* Floating Icons */}
          <View
            className="absolute top-10 left-8 p-3 rounded-full shadow-md"
            style={{ backgroundColor: colors.card }}
          >
            <Icon name="Info" className="size-xl text-warn" />
          </View>
          <View
            className="absolute top-16 right-12 p-3 rounded-full shadow-md"
            style={{ backgroundColor: colors.card }}
          >
            <Icon name="AlertCircle" className="size-xl text-destructive" />
          </View>
          <View
            className="absolute bottom-20 left-16 p-3 rounded-full shadow-md"
            style={{ backgroundColor: colors.card }}
          >
            <Icon name="Compass" className="size-lg text-primary" />
          </View>
          <View
            className="absolute bottom-24 right-8 p-3 rounded-full shadow-md"
            style={{ backgroundColor: colors.card }}
          >
            <Icon name="SearchX" className="size-xl text-accent-foreground" />
          </View>

          {/* Center Icon */}
          <View
            className="absolute p-6 rounded-full shadow-lg"
            style={{ backgroundColor: colors.card }}
          >
            <Icon name="Compass" className="size-2xl text-success" />
          </View>
        </View>

        {/* Text Content */}
        <View className="items-center gap-3 mb-10">
          <Text className="text-3xl font-bold text-foreground text-center">
            Page Not Found
          </Text>
          <Text className="text-base text-muted-foreground text-center leading-6 px-4">
            Oops! The page you&apos;re looking for doesn&apos;t exist.
          </Text>
          <Text className="text-base text-muted-foreground text-center leading-6">
            It might have been moved or deleted.
          </Text>
        </View>

        {/* Home Button */}
        <Link href="/" asChild>
          <TouchableOpacity className="size-14 items-center justify-center rounded-full bg-primary shadow-lg active:opacity-80">
            <Icon name="Home" className="size-base text-primary-foreground" />
          </TouchableOpacity>
        </Link>

        {/* Additional Help Text */}
        <Text className="text-sm text-muted-foreground text-center mt-8">
          Update {updateVersion}
        </Text>
      </View>
    </>
  );
}
