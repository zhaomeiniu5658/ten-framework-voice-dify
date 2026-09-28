import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  COLOR_LIST,
  DEFAULT_AGENT_SETTINGS,
  DEFAULT_COZE_SETTINGS,
  DEFAULT_DIFY_SETTINGS,
  DEFAULT_OCEAN_BASE_SETTINGS,
  DEFAULT_OPTIONS,
  EMobileActiveTab,
  resetCozeSettings as resetCozeSettingsLocal,
  resetDifySettings as resetDifySettingsLocal,
  resetOceanBaseSettings as resetOceanBaseSettingsLocal,
  setAgentSettingsToLocal,
  setCozeSettingsToLocal,
  setDifySettingsToLocal,
  setOceanBaseSettingsToLocal,
  setOptionsToLocal,
} from "@/common";
import type {
  IAgentSettings,
  IChatItem,
  ICozeSettings,
  IDifySettings,
  IOceanBaseSettings,
  IOptions,
  Language,
  VoiceType,
} from "@/types";

export interface InitialState {
  nextChatItemId: number;
  interviewSessionId: string;
  interviewEnded: boolean;
  options: IOptions;
  roomConnected: boolean;
  agentConnected: boolean;
  agentConnecting: boolean;
  rtmConnected: boolean;
  themeColor: string;
  language: Language;
  voiceType: VoiceType;
  chatItems: IChatItem[];
  graphName: string;
  agentSettings: IAgentSettings;
  cozeSettings: ICozeSettings;
  difySettings: IDifySettings;
  oceanbaseSettings: IOceanBaseSettings;
  mobileActiveTab: EMobileActiveTab;
  globalSettingsDialog: {
    open?: boolean;
    tab?: string;
  };
}

const getInitialState = (): InitialState => {
  return {
    nextChatItemId: 0,
    interviewSessionId: "",
    interviewEnded: false,
    options: DEFAULT_OPTIONS,
    themeColor: COLOR_LIST[0].active,
    roomConnected: false,
    agentConnected: false,
    agentConnecting: false,
    rtmConnected: false,
    language: "zh-CN",
    voiceType: "male",
    chatItems: [],
    graphName: "va_dify_azure",
    agentSettings: DEFAULT_AGENT_SETTINGS,
    cozeSettings: DEFAULT_COZE_SETTINGS,
    difySettings: DEFAULT_DIFY_SETTINGS,
    oceanbaseSettings: DEFAULT_OCEAN_BASE_SETTINGS,
    mobileActiveTab: EMobileActiveTab.AGENT,
    globalSettingsDialog: { open: false },
  };
};

export const globalSlice = createSlice({
  name: "global",
  initialState: getInitialState(),
  reducers: {
    beginInterview: (state, action: PayloadAction<string>) => {
      state.interviewSessionId = action.payload;
      state.interviewEnded = false;
      state.chatItems = [];
    },
    setInterviewSessionId: (state, action: PayloadAction<string>) => {
      state.interviewSessionId = action.payload;
      state.interviewEnded = false;
    },
    endInterview: (state) => { state.interviewEnded = true; },
    setOptions: (state, action: PayloadAction<Partial<IOptions>>) => {
      state.options = { ...state.options, ...action.payload };
      setOptionsToLocal(state.options);
    },
    setThemeColor: (state, action: PayloadAction<string>) => {
      state.themeColor = action.payload;
      document.documentElement.style.setProperty(
        "--theme-color",
        action.payload
      );
    },
    setRoomConnected: (state, action: PayloadAction<boolean>) => {
      state.roomConnected = action.payload;
    },
    setRtmConnected: (state, action: PayloadAction<boolean>) => {
      state.rtmConnected = action.payload;
    },
    addChatItem: (state, action: PayloadAction<IChatItem>) => {
      if (action.payload.data_type === "interview_completed") {
        state.interviewEnded = true;
        return;
      }
      if (state.interviewEnded && state.interviewSessionId) return;
      const { userId, text, isFinal, type, time } = action.payload;
      const normalizedText = text.trim();
      const recentDuplicate = state.chatItems
        .slice()
        .reverse()
        .find((el) => el.type === type && el.userId === userId);
      if (
        normalizedText.length > 0 &&
        recentDuplicate &&
        recentDuplicate.text.trim() === normalizedText &&
        Math.abs(time - recentDuplicate.time) < 8000
      ) {
        if (isFinal && !recentDuplicate.isFinal) {
          recentDuplicate.isFinal = true;
          recentDuplicate.time = time;
        }
        return;
      }
      const lastSameSpeakerIndex = state.chatItems.findLastIndex((el) => {
        return el.userId === userId && el.type === type;
      });
      const lastSameSpeakerItem = state.chatItems[lastSameSpeakerIndex];

      if (!lastSameSpeakerItem || lastSameSpeakerItem.isFinal) {
        console.log("[test] addChatItem, add new item:", text, isFinal, type);
        state.chatItems.push({ ...action.payload, id: `chat-${state.nextChatItemId++}` });
      } else if (time >= lastSameSpeakerItem.time) {
        console.log(
          "[test] addChatItem, update last item(none final):",
          text,
          isFinal,
          type
        );
        state.chatItems[lastSameSpeakerIndex] = {
          ...action.payload, id: lastSameSpeakerItem.id,
        };
      } else {
        console.log(
          "[test] addChatItem, time < last same speaker item, discard!:",
          text,
          isFinal,
          type
        );
        return;
      }
      state.chatItems.sort((a, b) => a.time - b.time);
    },
    setAgentConnected: (state, action: PayloadAction<boolean>) => {
      state.agentConnected = action.payload;
      if (action.payload) {
        state.agentConnecting = false;
      }
    },
    setAgentConnecting: (state, action: PayloadAction<boolean>) => {
      state.agentConnecting = action.payload;
    },
    setLanguage: (state, action: PayloadAction<Language>) => {
      state.language = action.payload;
    },
    setGraphName: (state, action: PayloadAction<string>) => {
      state.graphName = action.payload;
    },
    setAgentSettings: (
      state: { agentSettings: any },
      action: PayloadAction<Record<string, any>>
    ) => {
      state.agentSettings = { ...state.agentSettings, ...action.payload };
      setAgentSettingsToLocal(state.agentSettings);
    },
    setCozeSettings: (state, action: PayloadAction<Partial<ICozeSettings>>) => {
      state.cozeSettings = { ...state.cozeSettings, ...action.payload };
      setCozeSettingsToLocal(state.cozeSettings);
    },
    setDifySettings: (state, action: PayloadAction<Partial<IDifySettings>>) => {
      state.difySettings = { ...state.difySettings, ...action.payload };
      setDifySettingsToLocal(state.difySettings);
    },
    setOceanBaseSettings: (
      state,
      action: PayloadAction<Partial<IOceanBaseSettings>>
    ) => {
      state.oceanbaseSettings = {
        ...state.oceanbaseSettings,
        ...action.payload,
      };
      setOceanBaseSettingsToLocal(state.oceanbaseSettings);
    },
    resetCozeSettings: (state) => {
      state.cozeSettings = DEFAULT_COZE_SETTINGS;
      resetCozeSettingsLocal();
    },
    resetDifySettings: (state) => {
      state.difySettings = DEFAULT_DIFY_SETTINGS;
      resetDifySettingsLocal();
    },
    resetOceanBaseSettings: (state) => {
      state.oceanbaseSettings = DEFAULT_OCEAN_BASE_SETTINGS;
      resetOceanBaseSettingsLocal();
    },
    setVoiceType: (state, action: PayloadAction<VoiceType>) => {
      state.voiceType = action.payload;
    },
    setMobileActiveTab: (state, action: PayloadAction<EMobileActiveTab>) => {
      state.mobileActiveTab = action.payload;
    },
    setGlobalSettingsDialog: (
      state,
      action: PayloadAction<Partial<InitialState["globalSettingsDialog"]>>
    ) => {
      state.globalSettingsDialog = {
        ...state.globalSettingsDialog,
        ...action.payload,
      };
    },
    reset: (state) => {
      Object.assign(state, getInitialState());
      document.documentElement.style.setProperty(
        "--theme-color",
        COLOR_LIST[0].active
      );
    },
  },
});

export const {
  beginInterview,
  setInterviewSessionId,
  endInterview,
  reset,
  setOptions,
  setRoomConnected,
  setAgentConnected,
  setAgentConnecting,
  setRtmConnected,
  setVoiceType,
  addChatItem,
  setThemeColor,
  setLanguage,
  setGraphName,
  setAgentSettings,
  setCozeSettings,
  resetCozeSettings,
  setDifySettings,
  resetDifySettings,
  setOceanBaseSettings,
  resetOceanBaseSettings,
  setMobileActiveTab,
  setGlobalSettingsDialog,
} = globalSlice.actions;

export default globalSlice.reducer;
