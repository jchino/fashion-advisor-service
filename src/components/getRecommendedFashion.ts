/**
 * Oracle Cloud Infrastructure (OCI) Process Automation (OPA) の Decision Service をコールする。
 */
import { Buffer } from 'buffer';
import { URLSearchParams } from 'url';
import { CustomComponent, CustomComponentMetadata, CustomComponentContext } from '@oracle/bots-node-sdk/lib';
import fetch from 'node-fetch';
import * as CONFIG from './decision-service-config.json';

export class GetRecommendedFashion implements CustomComponent {
  public metadata(): CustomComponentMetadata {
    return {
      name: 'getRecommendedFashion',
      properties: {
        plan: { required: true, type: 'entityVariable' },
      },
      supportedActions: ['success', 'status4xx', 'status5xx'],
    };
  }

  public async invoke(context: CustomComponentContext): Promise<void> {
    try {
      // 1. IDCS から Client Credential Grant でアクセストークンを取得する
      const accessToken = await this.getAccessToken();

      // 2. Decision Model Service をコールする
      // コンポーネント・プロパティの取得
      const { plan } = context.properties();
      const planValue = context.getVariable(plan);
      // Decision Service API のコール
      const recommendation = await this.getRecommendation(
        accessToken['access_token'],
        new Date(planValue.departure.value),
        planValue.destination.value,
        planValue.goal.value,
        planValue.gender.value,
        planValue.generation ? planValue.generation.value : '10代',
        planValue.situation ? planValue.situation.value : '友達',
      );
      if (!recommendation['problems']) {
        // TODO: 取得した値をメッセージとして返すか変数に書き込んで他のステートで表示させるか
        console.log(JSON.stringify(recommendation['interpretation']));
      } else {
        // TODO: 例外処理を書く
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
    generation: string,
    situation: string,
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
