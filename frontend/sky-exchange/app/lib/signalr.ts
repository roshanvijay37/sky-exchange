import * as signalR from "@microsoft/signalr";

let connection: signalR.HubConnection | null = null;

export function getConnection(): signalR.HubConnection {
  if (!connection) {
    connection = new signalR.HubConnectionBuilder()
      .withUrl("http://localhost:5000/hubs/odds")
      .withAutomaticReconnect()
      .build();
  }
  return connection;
}
