interface IWithContentLengthObserver {
    thresholdWarn: number;
    thresholdError: number;
    sizeLimitInMB: number;
}
declare const withContentLengthObserver: ({ thresholdWarn, thresholdError, sizeLimitInMB: _sizeLimitInMB, }: IWithContentLengthObserver) => {
    after: (handlerRequestContext: any) => Promise<void>;
};
export default withContentLengthObserver;
