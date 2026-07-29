#import <Foundation/Foundation.h>

@interface KeyboardBrightnessClient : NSObject
- (id)copyKeyboardBacklightIDs;
- (float)brightnessForKeyboard:(unsigned long long)keyboard;
- (BOOL)setBrightness:(float)brightness forKeyboard:(unsigned long long)keyboard;
- (BOOL)setBrightness:(float)brightness fadeSpeed:(int)fadeSpeed commit:(BOOL)commit forKeyboard:(unsigned long long)keyboard;
@end

static void print_usage(void) {
    fprintf(stderr, "Usage: agent-light-backlight <probe|get|set <0..1>>\n");
}

static KeyboardBrightnessClient *make_client(void) {
    NSBundle *bundle = [NSBundle bundleWithPath:@"/System/Library/PrivateFrameworks/CoreBrightness.framework"];
    if (bundle == nil || ![bundle load]) {
        fprintf(stderr, "CoreBrightness.framework is unavailable\n");
        return nil;
    }

    Class clientClass = NSClassFromString(@"KeyboardBrightnessClient");
    if (clientClass == Nil) {
        fprintf(stderr, "KeyboardBrightnessClient class is unavailable\n");
        return nil;
    }

    KeyboardBrightnessClient *client = [[clientClass alloc] init];
    if (client == nil) {
        fprintf(stderr, "failed to create KeyboardBrightnessClient\n");
        return nil;
    }
    return client;
}

static unsigned long long keyboard_id(KeyboardBrightnessClient *client) {
    unsigned long long fallback = 1;
    if (![client respondsToSelector:@selector(copyKeyboardBacklightIDs)]) {
        return fallback;
    }

    id ids = [client copyKeyboardBacklightIDs];
    if ([ids respondsToSelector:@selector(count)] && [ids count] > 0) {
        id first = [ids objectAtIndex:0];
        if ([first respondsToSelector:@selector(unsignedLongLongValue)]) {
            return [first unsignedLongLongValue];
        }
    }
    return fallback;
}

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        if (argc < 2) {
            print_usage();
            return 64;
        }

        NSString *command = [NSString stringWithUTF8String:argv[1]];
        KeyboardBrightnessClient *client = make_client();
        if (client == nil) return 1;

        unsigned long long kid = keyboard_id(client);

        if ([command isEqualToString:@"probe"]) {
            if (![client respondsToSelector:@selector(brightnessForKeyboard:)]) {
                fprintf(stderr, "brightnessForKeyboard selector is unavailable\n");
                return 1;
            }
            (void)[client brightnessForKeyboard:kid];
            printf("ok\n");
            return 0;
        }

        if ([command isEqualToString:@"get"]) {
            if (![client respondsToSelector:@selector(brightnessForKeyboard:)]) {
                fprintf(stderr, "brightnessForKeyboard selector is unavailable\n");
                return 1;
            }
            printf("%.4f\n", [client brightnessForKeyboard:kid]);
            return 0;
        }

        if ([command isEqualToString:@"set"]) {
            if (argc < 3) {
                print_usage();
                return 64;
            }

            char *end = NULL;
            double parsed = strtod(argv[2], &end);
            if (end == argv[2] || !isfinite(parsed)) {
                fprintf(stderr, "brightness must be a number from 0 to 1\n");
                return 64;
            }
            float brightness = (float)fmax(0.0, fmin(1.0, parsed));
            BOOL ok = NO;

            if ([client respondsToSelector:@selector(setBrightness:fadeSpeed:commit:forKeyboard:)]) {
                ok = [client setBrightness:brightness fadeSpeed:0 commit:YES forKeyboard:kid];
            } else if ([client respondsToSelector:@selector(setBrightness:forKeyboard:)]) {
                ok = [client setBrightness:brightness forKeyboard:kid];
            } else {
                fprintf(stderr, "setBrightness selector is unavailable\n");
                return 1;
            }

            if (!ok) {
                fprintf(stderr, "CoreBrightness rejected keyboard brightness change\n");
                return 1;
            }
            return 0;
        }

        print_usage();
        return 64;
    }
}
