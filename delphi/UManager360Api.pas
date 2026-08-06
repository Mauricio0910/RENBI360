unit UManager360Api;

interface

uses
  System.SysUtils,
  System.JSON,
  REST.Client,
  REST.Types;

type
  EManager360Api = class(Exception);

  TManager360Api = class
  private
    FBaseURL: string;
    FToken: string;
    function Execute(const AResource: string; AMethod: TRESTRequestMethod;
      const ABody: string = ''; const AIdempotencyKey: string = ''): TJSONValue;
    function FilterQuery(const APeriod, AGranularity, AReference: string): string;
  public
    constructor Create(const ABaseURL: string);
    procedure SetToken(const AToken: string);

    function Login(const AUser, APassword: string): string;
    function GetLicenseStatus: TJSONValue;
    function GetDashboard(const APeriod: string = '30d';
      const AGranularity: string = 'month'; const AReference: string = ''): TJSONValue;
    function GetDRE(const APeriod: string = '30d';
      const AGranularity: string = 'month'; const AReference: string = ''): TJSONValue;
    function GetDailySales(const APeriod: string = '30d';
      const AGranularity: string = 'month'; const AReference: string = ''): TJSONValue;
    function GetSalesProjection(const APeriod: string = '30d';
      const AGranularity: string = 'month'; const AReference: string = ''): TJSONValue;
    function GetFinancialObligations(const APeriod: string = '30d';
      const AGranularity: string = 'month'; const AReference: string = ''): TJSONValue;
    function GetDebtors(const APeriod: string = '30d';
      const AGranularity: string = 'month'; const AReference: string = ''): TJSONValue;
    function GetSalesTeamPerformance: TJSONValue;
    function GetSupplierRanking: TJSONValue;
    function GetLastSync: TJSONValue;
    function SendBatch(const AJsonPayload, AIdempotencyKey: string): TJSONValue;
  end;

implementation

constructor TManager360Api.Create(const ABaseURL: string);
begin
  inherited Create;
  FBaseURL := ABaseURL.TrimRight(['/']);
end;

procedure TManager360Api.SetToken(const AToken: string);
begin
  FToken := AToken;
end;

function TManager360Api.FilterQuery(const APeriod, AGranularity,
  AReference: string): string;
begin
  Result := '?period=' + APeriod + '&granularity=' + AGranularity;
  if AReference <> '' then
    Result := Result + '&reference=' + AReference;
end;

function TManager360Api.Execute(const AResource: string;
  AMethod: TRESTRequestMethod; const ABody, AIdempotencyKey: string): TJSONValue;
var
  Client: TRESTClient;
  Request: TRESTRequest;
  Response: TRESTResponse;
begin
  Client := TRESTClient.Create(nil);
  Request := TRESTRequest.Create(nil);
  Response := TRESTResponse.Create(nil);
  try
    Client.BaseURL := FBaseURL;
    Request.Client := Client;
    Request.Response := Response;
    Request.Resource := AResource.TrimLeft(['/']);
    Request.Method := AMethod;

    Request.AddParameter('Accept', 'application/json', pkHTTPHEADER, [poDoNotEncode]);

    if FToken <> '' then
      Request.AddParameter('Authorization', 'Bearer ' + FToken,
        pkHTTPHEADER, [poDoNotEncode]);

    if AIdempotencyKey <> '' then
      Request.AddParameter('X-Idempotency-Key', AIdempotencyKey,
        pkHTTPHEADER, [poDoNotEncode]);

    if ABody <> '' then
      Request.AddBody(ABody, ctAPPLICATION_JSON);

    Request.Execute;

    if (Response.StatusCode < 200) or (Response.StatusCode >= 300) then
      raise EManager360Api.CreateFmt('HTTP %d - %s',
        [Response.StatusCode, Response.Content]);

    if Response.Content.Trim = '' then
      Exit(TJSONObject.Create);

    Result := TJSONObject.ParseJSONValue(Response.Content);
    if not Assigned(Result) then
      raise EManager360Api.Create('Resposta JSON inválida.');
  finally
    Response.Free;
    Request.Free;
    Client.Free;
  end;
end;

function TManager360Api.Login(const AUser, APassword: string): string;
var
  Body: TJSONObject;
  Json: TJSONValue;
begin
  Body := TJSONObject.Create;
  try
    Body.AddPair('username', AUser);
    Body.AddPair('password', APassword);
    Json := Execute('api/v1/auth/login', rmPOST, Body.ToJSON);
    try
      Result := Json.GetValue<string>('access_token');
      FToken := Result;
    finally
      Json.Free;
    end;
  finally
    Body.Free;
  end;
end;

function TManager360Api.GetLicenseStatus: TJSONValue;
begin
  Result := Execute('api/v1/license/status', rmGET);
end;

function TManager360Api.GetDashboard(const APeriod, AGranularity,
  AReference: string): TJSONValue;
begin
  Result := Execute('api/v1/dashboard/summary' +
    FilterQuery(APeriod, AGranularity, AReference), rmGET);
end;

function TManager360Api.GetDRE(const APeriod, AGranularity,
  AReference: string): TJSONValue;
begin
  Result := Execute('api/v1/finance/dre' +
    FilterQuery(APeriod, AGranularity, AReference), rmGET);
end;

function TManager360Api.GetDailySales(const APeriod, AGranularity,
  AReference: string): TJSONValue;
begin
  Result := Execute('api/v1/sales/daily' +
    FilterQuery(APeriod, AGranularity, AReference), rmGET);
end;

function TManager360Api.GetSalesProjection(const APeriod, AGranularity,
  AReference: string): TJSONValue;
begin
  Result := Execute('api/v1/projections/overview' +
    FilterQuery(APeriod, AGranularity, AReference), rmGET);
end;

function TManager360Api.GetFinancialObligations(const APeriod, AGranularity,
  AReference: string): TJSONValue;
begin
  Result := Execute('api/v1/finance/obligations' +
    FilterQuery(APeriod, AGranularity, AReference), rmGET);
end;

function TManager360Api.GetDebtors(const APeriod, AGranularity,
  AReference: string): TJSONValue;
begin
  Result := Execute('api/v1/finance/debtors' +
    FilterQuery(APeriod, AGranularity, AReference), rmGET);
end;

function TManager360Api.GetSalesTeamPerformance: TJSONValue;
begin
  Result := Execute('api/v1/sales-team/performance', rmGET);
end;

function TManager360Api.GetSupplierRanking: TJSONValue;
begin
  Result := Execute('api/v1/suppliers/ranking', rmGET);
end;

function TManager360Api.GetLastSync: TJSONValue;
begin
  Result := Execute('api/v1/integration/last-sync', rmGET);
end;

function TManager360Api.SendBatch(const AJsonPayload,
  AIdempotencyKey: string): TJSONValue;
begin
  Result := Execute('api/v1/integration/batches', rmPOST,
    AJsonPayload, AIdempotencyKey);
end;

end.
