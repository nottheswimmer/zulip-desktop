import { ipcRenderer, remote } from 'electron';

import * as LinkUtil from '../utils/link-util';
import * as DomainUtil from '../utils/domain-util';
import * as ConfigUtil from '../utils/config-util';
import type WebView from './webview';

const { shell, app } = remote;

const dingSound = new Audio('../resources/sounds/ding.ogg');

export default function handleExternalLink(this: WebView, event: Electron.NewWindowEvent): void {
	const { url } = event;
	const domainPrefix = DomainUtil.getDomain(this.props.index).url;
	const downloadPath = ConfigUtil.getConfigItem('downloadsPath', `${app.getPath('downloads')}`);

	// Whitelist URLs which are allowed to be opened in the app
	const {
		isInternalUrl: isWhiteListURL,
		isUploadsUrl: isUploadsURL
	} = LinkUtil.isInternal(domainPrefix, url);

	if (isWhiteListURL) {
		event.preventDefault();

		// Code to show pdf in a new BrowserWindow (currently commented out due to bug-upstream)
		// Show pdf attachments in a new window
		// if (LinkUtil.isPDF(url) && isUploadsURL) {
		// 	ipcRenderer.send('pdf-view', url);
		// 	return;
		// }

		// download txt, mp3, mp4 etc.. by using downloadURL in the
		// main process which allows the user to save the files to their desktop
		// and not trigger webview reload while image in webview will
		// do nothing and will not save it

		// Code to show pdf in a new BrowserWindow (currently commented out due to bug-upstream)
		// if (!LinkUtil.isImage(url) && !LinkUtil.isPDF(url) && isUploadsURL) {
		if (!LinkUtil.isImage(url) && isUploadsURL) {
			ipcRenderer.send('downloadFile', url, downloadPath);
			ipcRenderer.once('downloadFileCompleted', (_event: Event, filePath: string, fileName: string) => {
				const downloadNotification = new Notification('Download Complete', {
					body: `Click to show ${fileName} in folder`,
					silent: true // We'll play our own sound - ding.ogg
				});

				// Play sound to indicate download complete
				if (!ConfigUtil.getConfigItem('silent')) {
					dingSound.play();
				}

				downloadNotification.addEventListener('click', () => {
					// Reveal file in download folder
					shell.showItemInFolder(filePath);
				});
				ipcRenderer.removeAllListeners('downloadFileFailed');
			});

			ipcRenderer.once('downloadFileFailed', () => {
				// Automatic download failed, so show save dialog prompt and download
				// through webview
				// Only do this if it is the automatic download, otherwise show an error (so we aren't showing two save
				// prompts right after each other)
				if (ConfigUtil.getConfigItem('promptDownload', false)) {
					// We need to create a "new Notification" to display it, but just `Notification(...)` on its own
					// doesn't work
					new Notification('Download Complete', { // eslint-disable-line no-new
						body: 'Download failed'
					});
				} else {
					this.$el.downloadURL(url);
				}
				ipcRenderer.removeAllListeners('downloadFileCompleted');
			});
			return;
		}

		// open internal urls inside the current webview.
		this.$el.loadURL(url);
	} else {
		event.preventDefault();
		shell.openExternal(url);
	}
}
