export {};

declare global {
  interface Window {
    Actual?: {
      IS_FAKE_WEB: boolean;
      ACTUAL_VERSION: string;
      openURLInBrowser: (url: string) => void;
<<<<<<< Updated upstream
=======
      downloadActualServer: (releaseVersion: string) => Promise<void>;
      startActualServer: (releaseVersion: string) => Promise<void>;
      exposeActualServer: (
        settings: GlobalPrefs['ngrokConfig'],
      ) => Promise<{ url?: string; error?: string } | undefined>;
      setStartupOptions: (options: { openAtLogin?: boolean }) => void;
>>>>>>> Stashed changes
      saveFile: (
        contents: string | Buffer,
        filename: string,
        dialogTitle: string,
      ) => void;
      openFileDialog: (
        opts: Parameters<import('electron').Dialog['showOpenDialogSync']>[0],
      ) => Promise<string[]>;
      relaunch: () => void;
      reload: (() => Promise<void>) | undefined;
      restartElectronServer: () => void;
      moveBudgetDirectory: (
        currentBudgetDirectory: string,
        newDirectory: string,
      ) => Promise<void>;
    };

    __navigate?: import('react-router').NavigateFunction;
  }
}
