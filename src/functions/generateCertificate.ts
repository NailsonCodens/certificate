import { APIGatewayProxyHandler } from "aws-lambda"
import { document } from "../utils/dynamodbClient";
import { compile } from "handlebars";
import dayjs from "dayjs";
import {join } from "path";
import { readFileSync } from "fs";
import chromium from "chrome-aws-lambda";
import {S3} from "aws-sdk";

interface ICreateCertificate {
  id: string;
  name: string;
  grade: string;
}

interface ITemplate {
  id: string;
  name: string;
  grade: string;
  medal: string;
  date: string;
}

const compileTemplate = async (data: ITemplate) => {
  const filePath = join(process.cwd(), "src", "templates", 'certificate.hbs');

  const html = readFileSync(filePath, "utf-8");

  return compile(html)(data)
}

export const handler: APIGatewayProxyHandler = async (event) => {
  const {id, name, grade} = JSON.parse(event.body) as ICreateCertificate;

  const response = await document.query({
    TableName: "users_certificate",
    KeyConditionExpression: "id = :id",
    ExpressionAttributeValues: {
      ":id": id
    }
  }).promise();

  const userAlredyExists = response.Items[0];

  if(userAlredyExists){
    await document.put({
      TableName: "users_certificate",
      Item: {
        id,
        name,
        grade,
        created_at: new Date().getTime(),
      }
    }).promise();  
  }


  const medalPath = join(process.cwd(), "src", "templates", "selo.png");
  const medal = readFileSync(medalPath, "base64");

  const data: ITemplate = {
    name,
    id,
    grade,
    date: dayjs().format("DD/MM/YYYY"),
    medal
  }

  const content = await compileTemplate(data)

  let propsPuppteer = {};

  if(process.env.IS_OFFLINE){
    propsPuppteer = {
      args: [
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-setuid-sandbox',
        '--no-first-run',
        '--no-sandbox',
        '--no-zygote',
        '--single-process',
      ]      
    }
  }else{
    propsPuppteer = {
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath, 
    }    
  }

  const browser = await chromium.puppeteer.launch(propsPuppteer);  

  const page = await browser.newPage();

  await page.setContent(content);
  const pdf = await page.pdf({
    format: "A4",
    landscape: true,
    printBackground: true,
    preferCSSPageSize: true,
    path: process.env.IS_OFFLINE ? './certificate.pdf' : null
  })

  await browser.close();

  const s3 = new S3();

  /*await s3.createBucket({
    Bucket: "certificateignite2021",
  }).promise();*/

  await s3.putObject({
    Bucket: "certificateignite2021",
    Key: `${id}.pdf`,
    ACL: "public-read",
    Body: pdf,
    ContentType: "application/pdf"
  }).promise();

  return {
    statusCode: 201,
    body: JSON.stringify({
      message: "Certificado creado com sucesso!",
      url: `https://certificateignite2021.s3.amazonaws.com/${id}.pdf`
    })
  }
}