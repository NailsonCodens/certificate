import { DynamoDB } from "aws-sdk";

const options = {
  region: "localhost",
  endpoint: "http://localhost:8000",
  accessKeyId: "x",
  secretAccessKey: "x",
}

const isOffiline = () => {
  return process.env.IS_OFFLINE;
}

export const document = isOffiline() ? new DynamoDB.DocumentClient(options) : new DynamoDB.DocumentClient();