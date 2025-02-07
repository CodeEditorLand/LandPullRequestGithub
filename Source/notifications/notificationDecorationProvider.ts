/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

import { Disposable } from "../common/lifecycle";
import {
	EXPERIMENTAL_NOTIFICATIONS_SCORE,
	PR_SETTINGS_NAMESPACE,
} from "../common/settingKeys";
import { fromNotificationUri, toNotificationUri } from "../common/uri";
import {
	NotificationsManager,
	NotificationsSortMethod,
} from "./notificationsManager";

export class NotificationsDecorationProvider
	extends Disposable
	implements vscode.FileDecorationProvider
{
	private _readonlyOnDidChangeFileDecorations: vscode.EventEmitter<
		vscode.Uri[]
	> = this._register(new vscode.EventEmitter<vscode.Uri[]>());

	public readonly onDidChangeFileDecorations =
		this._readonlyOnDidChangeFileDecorations.event;

	constructor(private readonly _notificationsManager: NotificationsManager) {
		super();

		this._register(
			_notificationsManager.onDidChangeNotifications((updates) => {
				const uris = updates.map((update) =>
					toNotificationUri({ key: update.notification.key }),
				);

				this._readonlyOnDidChangeFileDecorations.fire(uris);
			}),
		);

		this._register(
			vscode.workspace.onDidChangeConfiguration((e) => {
				if (
					e.affectsConfiguration(
						`${PR_SETTINGS_NAMESPACE}.${EXPERIMENTAL_NOTIFICATIONS_SCORE}`,
					)
				) {
					this._readonlyOnDidChangeFileDecorations.fire(
						_notificationsManager
							.getAllNotifications()
							.map((notification) =>
								toNotificationUri({
									key: notification.notification.key,
								}),
							),
					);
				}
			}),
		);
	}

	private settingValue(): boolean {
		return vscode.workspace
			.getConfiguration(PR_SETTINGS_NAMESPACE)
			.get(EXPERIMENTAL_NOTIFICATIONS_SCORE, false);
	}

	provideFileDecoration(
		uri: vscode.Uri,
		_token: vscode.CancellationToken,
	): vscode.ProviderResult<vscode.FileDecoration> {
		if (!this.settingValue()) {
			return undefined;
		}

		if (
			this._notificationsManager.sortingMethod !==
			NotificationsSortMethod.Priority
		) {
			return undefined;
		}

		const notificationUriParams = fromNotificationUri(uri);

		if (!notificationUriParams) {
			return undefined;
		}

		// Limit the length of the priority badge to two characters
		const notification = this._notificationsManager.getNotification(
			notificationUriParams.key,
		);

		const priority =
			notification?.priority === "100"
				? "99"
				: (notification?.priority ?? "0");

		return {
			badge: priority,
			tooltip: vscode.l10n.t(
				"Priority score is {0}. {1}",
				priority,
				notification?.priorityReason ?? "",
			),
		};
	}
}
