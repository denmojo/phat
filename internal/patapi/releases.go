package patapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

// ReleasesBaseURL is the GitHub API root that Phat's releases are read from.
var ReleasesBaseURL = "https://api.github.com"

const releasesRepo = "denmojo/phat"

type LatestRelease struct {
	Version    string `json:"version"`
	ReleaseURL string `json:"release_url"`
}

// GetLatestVersion retrieves Phat's latest GitHub release. It returns nil
// and no error when the repository has no release yet.
func GetLatestVersion(ctx context.Context) (*LatestRelease, error) {
	url := ReleasesBaseURL + "/repos/" + releasesRepo + "/releases/latest"
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("getting latest version: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var gh struct {
		TagName string `json:"tag_name"`
		HTMLURL string `json:"html_url"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&gh); err != nil {
		return nil, fmt.Errorf("decoding response: %w", err)
	}
	return &LatestRelease{Version: strings.TrimPrefix(gh.TagName, "v"), ReleaseURL: gh.HTMLURL}, nil
}
