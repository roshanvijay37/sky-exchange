import * as signalR from "@microsoft/signalr";

let connection: signalR.HubConnection | null = null;

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL ?? "http://localhost:5000/hubs/odds";

export function getConnection(): signalR.HubConnection {
  if (!connection) {
    connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL)
      .withAutomaticReconnect()
      .build();
  }
  return connection;
}
