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
        // departure: { required: true, type: 'string' }, // いつ行くのか (yyyy-MM-dd を想定)
        // destination: { required: true, type: 'string' }, // 行き先 (東京 or 大阪 or 北海道 or 沖縄)
        // goal: { required: true, type: 'string' }, // 目的地 (海 or 山 or 遊園地 or カフェ)
        // gender: { required: true, type: 'string' }, // 性別 (男性 or 女性)
        // generation: { required: false, type: 'string' }, // 世代 (10代 or 20代〜30代 or 40代以上)
        // situation: { required: false, type: 'string' }, // 誰と行くか (友達 or 家族 or 恋人)
      },
      supportedActions: ['success', 'status4xx', 'status5xx'],
    };
  }

  public async invoke(context: CustomComponentContext): Promise<void> {
    try {
      // 1. IDCS から Client Credential Grant でアクセストークンを取得する
      const accessToken = await this.getAccessToken();

      // 2. Decision Model Service をコールする
      // TODO: コンポーネントのパラメータを使用するようにあとで置き換える
      const departure = new Date();
      const destination = '東京';
      const goal = '海';
      const gender = '男性';
      const generation = '40代以上';
      const situation = '家族';

      const recommendation = await this.getRecommendation(
        accessToken['access_token'],
        departure,
        destination,
        goal,
        gender,
        generation,
        situation,
      );
      if (!recommendation['problems']) {
        console.log(JSON.stringify(recommendation['interpretation']));
      } else {
        console.error('問題発生');
        console.log(JSON.stringify(recommendation['problems'], null, 2));
      }
    } catch (error) {
      console.error(error);
    }
    context.transition('success');
  }

  /**
   * Oracle Identity Cloud Service (IDCS) から Client Credential Grant の OAuth2 トークンを取得する。
   * 取得した OAuth2 トークンは、OPA の Decision Service の API をコールするために必要
   *
   * @see https://docs.oracle.com/en/cloud/paas/identity-cloud/rest-api/op-oauth2-v1-token-post.html
   * @returns Promise<any>
   */
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
        headers: { Authorization: `Basic ${auth}` },
        body: params,
      });
      if (res.ok) {
        return await res.json();
      } else {
        throw new Error(res.statusText);
      }
    } catch (error) {
      throw new Error();
    }
  }

  /**
   * OPA Decision Service の REST API をコールして、行き先や目的などに合わせたおすすめのファッションを取得
   *
   * @see https://docs.oracle.com/en/cloud/paas/process-automation/user-process-automation/call-decision-service.html#GUID-76B3C6D4-1A24-4D4F-BE84-E3C095CF37A9
   * @param accessToken {string} OAuth2 のアクセス・トークン
   * @param departure {Date} 外出する日
   * @param destination {string} 外出先 (東京 or 大阪 or 北海道 or 沖縄)
   * @param goal {string} 目的 (海 or 山 or 遊園地 or )
   * @param gender {string} 性別 (男性 or 女性)
   * @param generation {string} 世代 (10代 or 20代〜30代 or 40代)
   * @param situation {string} シチュエーション（一緒に出かける相手） (友達 or 家族 or 恋人)
   * @returns Promise<any>
   */
  protected async getRecommendation(
    accessToken: string,
    departure: Date,
    destination: string,
    goal: string,
    gender: string,
    generation: string = '10代',
    situation: string = '友達',
  ): Promise<any> {
    const serviceUrl = CONFIG.decisionServiceUrl;
    const requestBody = new FashionAdviserServiceRequest(departure, destination, goal, gender, generation, situation);
    try {
      console.log(requestBody.getRequestBodyValue());
      const response = await fetch(serviceUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: requestBody.getRequestBodyValue(),
      });
      if (response.ok) {
        return await response.json();
      } else {
        throw new Error(response.statusText);
      }
    } catch (error) {
      throw new Error();
    }
  }
}

/**
 * Decision Service の入力パラメータを生成
 */
class FashionAdviserServiceRequest {
  protected departure: Date;
  protected destination: string;
  protected goal: string;
  protected gender: string;
  protected generation: string;
  protected situation: string;

  constructor(
    departure: Date,
    destination: string,
    goal: string,
    gender: string,
    generation: string,
    situation: string,
  ) {
    this.departure = departure;
    this.destination = destination;
    this.goal = goal;
    this.gender = gender;
    this.generation = generation;
    this.situation = situation;
  }

  public getRequestBodyValue(): string {
    const body = {
      FashionAdviserInput: {
        month: this.departure.getMonth() + 1,
        destination: this.destination,
        goal: this.goal,
        gender: this.gender,
        generation: this.generation,
        situation: this.situation,
      },
    };
    return JSON.stringify(body);
  }
}
