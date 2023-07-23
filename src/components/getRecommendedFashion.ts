/**
 * Oracle Cloud Infrastructure (OCI) Process Automation (OPA) の Decision Service をコールする。
 */
import { Buffer } from 'buffer';
import { CustomComponent, CustomComponentMetadata, CustomComponentContext } from '@oracle/bots-node-sdk/lib';
import { URLSearchParams } from 'url';
import fetch from 'node-fetch';
import * as CONFIG from './decision-service-config.json';

export class GetRecommendedFashion implements CustomComponent {
  public metadata(): CustomComponentMetadata {
    return {
      name: 'getRecommendedFashion',
      properties: {
        // temperature: { required: true, type: 'string' }, // 気温 (摂氏)
        // precipitation: { required: true, type: 'string' }, // 降水確率 (0〜100)
        // goal: { required: true, type: 'string' }, // 目的地 (海 or 山 or 遊園地 or カフェ)
        // gender: { required: true, type: 'string' }, // 性別 (男の子 or 女の子)
      },
      supportedActions: ['success', 'status4xx', 'status5xx'],
    };
  }

  public async invoke(context: CustomComponentContext): Promise<void> {
    try {
      // 1. IDCS から Client Credential Grant でアクセストークンを取得する
      const accessToken = await this.getAccessToken();

      // 2. Decision Model Service をコールする
      const temperature = 30;
      const precipitation = 40;
      const goal = "海";
      const gender = "男の子";
      const recommendation = await this.getRecommendation(accessToken['access_token'], temperature, precipitation, goal, gender);
      if (!recommendation['problems']) {
        console.log(JSON.stringify(recommendation['interpretation']));
      }
      else {
        console.error('問題発生');
        console.log(JSON.stringify(recommendation['problems'], null, 2));
      }
    }
    catch (error) {
      console.error(error);
    }
    context.transition('success');
  }

  protected async getAccessToken(): Promise<any> {
    const tokenUrl = CONFIG.tokenUrl;
    const clientId = CONFIG.clientId;
    const clientSecret = CONFIG.clientSecret;
    const scope = CONFIG.scope;

    // Authorization
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    // Request Body
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('scope', scope);

    try {
      const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: {'Authorization': `Basic ${auth}`},
        body: params
      });
      if (res.ok) {
        return await res.json();
      }
      else {
        throw new Error(res.statusText);
      }
    }
    catch (error) {
      throw new Error();
    }
  }

  protected async getRecommendation(accessToken: string, temperature: number, precipitation: number, goal: string, gender: string): Promise<any> {
    const serviceUrl = CONFIG.decisionServiceUrl;
    // Request Body
    const requestBody = new FashionAdviserServiceRequest(temperature, precipitation, goal, gender);
    try {
      console.log(requestBody.generateRequestBody());
      const response = await fetch(serviceUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: requestBody.generateRequestBody()
      });
      if (response.ok) {
        return await response.json();
      }
      else {
        throw new Error(response.statusText);
      }
    }
    catch (error) {
      throw new Error();
    }
  }
}

class FashionAdviserServiceRequest {
  protected temperature: number;
  protected precipitation: number;
  protected goal: string;
  protected gender: string;

  constructor(temperature: number, precipitation: number, goal: string, gender: string) {
    this.temperature = temperature;
    this.precipitation = precipitation;
    this.goal = goal;
    this.gender = gender;
  }

  public generateRequestBody(): string {
    const body = {
      FashionAdviserInput: {
        Temperature: this.temperature,
        Precipitation: this.precipitation,
        Goal: this.goal,
        Gender: this.gender
      }
    };
    return JSON.stringify(body);
  }
}