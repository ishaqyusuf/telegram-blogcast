import { ItemProps } from "@/components/home-feed/home-feed-post-card";
import { File, Directory, Paths } from "expo-file-system";
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";

import { getTelegramFileUrl } from "@/lib/get-telegram-file";
import { minuteToString } from "./utils";
import { ToastAndroid } from "react-native";
export async function play(item: ItemProps) {
  const { audio } = item;
  if (!audio) throw new Error();
  // const filePath = `${FileSystem.documentDirectory}al-ghurobaa/media/${audio.fileName}`;
  const folderPath = `${Paths.document}al-ghurobaa/media/`;
  const filePath = `${folderPath}${audio.fileName}`;

  // Ensure the folder exists
  const folderInfo = new File(folderPath).info();
  if (!folderInfo.exists) {
    await new Directory().create(folderPath, { intermediates: true });
  }
  const handlePlaybackUpdate = (status) => {
    if (status.isLoaded) {
      const currentMillis = status.positionMillis || 0;
      const totalMillis = status.durationMillis || 1; // Avoid divide by zero
      setData({
        currentTime: minuteToString(currentMillis),
        seekPosition: currentMillis,
        progressPercentage: (currentMillis / totalMillis) * 100,
        duration: totalMillis,
      });
    }
  };
  const fileInfo = new File(filePath).info();

  if (fileInfo.exists) {
    // Load audio from local file
    play(filePath);
  } else {
    // Fetch audio URL via tRPC or API
    //   const audioUrl = await fetchAudio(post.audio.fileId); // Your tRPC call to fetch the audio URL
    const audioUrl = (await getTelegramFileUrl(audio.telegramFileId))?.url;
    if (!audioUrl) {
      //   ToastAndroid.show({ text: "Audio URL is not available!", duration: 3000 });
      ToastAndroid.show("Audi url is not avaible", 2000);
      return;
    }
    // Stream the audio immediately
    const downloadResumable = FileSystem.createDownloadResumable(
      audioUrl,
      filePath,
      {},
      async (downloadProgress) => {
        // Track download progress if needed
        const progress =
          downloadProgress.totalBytesWritten /
          downloadProgress.totalBytesExpectedToWrite;
        setData({ downloadProgress: progress });
      }
    );

    const downloadPromise = downloadResumable.downloadAsync().catch((err) => {
      console.error("Download failed:", err);
    });

    // Start streaming audio
    await play(audioUrl);

    // Wait for the download to complete
    // downloadPromise.then();
    downloadResumable
      .downloadAsync()
      .then(async () => {
        // Once download completes, switch to offline mode (local file playback)
        await play(filePath);
        setData({ downloadProgress: 1 }); // Download complete
      })
      .catch((err) => {
        console.error("Download failed:", err);
        //  Toast.show({ text: "Audio download failed!", duration: 3000 });
      });
    //   await play(audioUrl);

    //   setAudioUri(audioUrl);
    //   streamedSound.setOnPlaybackStatusUpdate(handlePlaybackUpdate);

    // setAudioDuration(status.durationMillis || null);
    //   setIsPlaying(true);

    // Download audio and save to local storage in the background
    // const { size } = await FileSystem.downloadAsync(audioUrl, filePath);
    // setAudioSize(size);
  }
  async function play(uri) {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true, // Ensure audio stays active in the background
      playThroughEarpieceAndroid: false,
      shouldDuckAndroid: false,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
    });
    const { sound: newSound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true, positionMillis: ctx.seekPosition }
    );
    setSound(newSound);
    newSound.setOnPlaybackStatusUpdate(handlePlaybackUpdate);
    setIsFooterPlaying(true);
  }
  // setIsLoading(false);
  // if (footerAudio?.uri) {
  //   const { sound: newSound } = await Audio.Sound.createAsync(
  //     { uri: footerAudio.audioUri },
  //     { shouldPlay: false },
  //   );
  //   setSound(newSound);
  // }
}
