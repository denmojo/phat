package cmsapi

import (
	"context"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"testing"
)

type refuseTransport struct{ t *testing.T }

func (r refuseTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	r.t.Errorf("unexpected request to %s", req.URL)
	return nil, errors.New("network disabled in test")
}

func noNetwork(t *testing.T) {
	old := http.DefaultClient.Transport
	http.DefaultClient.Transport = refuseTransport{t}
	t.Cleanup(func() { http.DefaultClient.Transport = old })
}

func TestCallsRefuseWithoutKey(t *testing.T) {
	if AccessKey != "" {
		t.Skip("Phat has its own access key")
	}
	noNetwork(t)
	ctx := context.Background()
	calls := map[string]func() error{
		"AccountExists":            func() error { _, err := AccountExists(ctx, "N0CALL"); return err },
		"ValidatePassword":         func() error { _, err := ValidatePassword(ctx, "N0CALL", "pw"); return err },
		"AccountAdd":               func() error { return AccountAdd(ctx, "N0CALL", "pw", "") },
		"VersionAdd":               func() error { return VersionAdd{Callsign: "N0CALL"}.Post() },
		"PasswordRecoveryEmailGet": func() error { _, err := PasswordRecoveryEmailGet(ctx, "N0CALL", "pw"); return err },
		"PasswordRecoveryEmailSet": func() error { return PasswordRecoveryEmailSet(ctx, "N0CALL", "pw", "a@b.c") },
		"HybridStationList":        func() error { _, err := HybridStationList(ctx); return err },
		"MPSGet":                   func() error { _, err := MPSGet(ctx, "N0CALL", "N0CALL"); return err },
		"MPSAdd":                   func() error { return MPSAdd(ctx, "N0CALL", "N0CALL", "pw", "N1CALL") },
		"MPSDelete":                func() error { return MPSDelete(ctx, "N0CALL", "N0CALL", "pw") },
		"GetGatewayStatus":         func() error { _, err := GetGatewayStatus(ctx, "", 48); return err },
	}
	for name, call := range calls {
		if err := call(); !errors.Is(err, ErrNoAccessKey) {
			t.Errorf("%s: got %v, want ErrNoAccessKey", name, err)
		}
	}
}

func TestGatewayListFallsBackToEmbeddedWithoutKey(t *testing.T) {
	if AccessKey != "" {
		t.Skip("Phat has its own access key")
	}
	noNetwork(t)
	cache := filepath.Join(t.TempDir(), "rmslist.json")
	f, err := GetGatewayStatusCached(context.Background(), cache, false)
	if err != nil {
		t.Fatalf("cached list: %v", err)
	}
	defer f.(io.Closer).Close()
	if st, err := os.Stat(cache); err != nil || st.Size() == 0 {
		t.Fatalf("embedded list not written to cache: %v", err)
	}
	if _, err := GetGatewayStatusCached(context.Background(), cache+".2", true); !errors.Is(err, ErrNoAccessKey) {
		t.Errorf("forced download: got %v, want ErrNoAccessKey", err)
	}
}
