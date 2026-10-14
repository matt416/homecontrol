import SwiftUI

struct PhotoPlaybackSettingsView: View {
    @ObservedObject var model: PhotoPlaybackSettingsModel
    let folder: URL?

    var body: some View {
        HomeSection("Slideshow") {
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .bottom, spacing: 24) { controls }
                VStack(alignment: .leading, spacing: 16) { controls }
            }
            Text(model.message ?? model.validationMessage ?? "Time per photo includes its transition. Set transition to 0 for an instant change.")
                .font(.caption).foregroundStyle(model.validationMessage == nil ? Color.secondary : .red)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    @ViewBuilder private var controls: some View {
        secondsField("Time per photo", text: $model.durationText)
        secondsField("Transition time", text: $model.transitionText)
        VStack(alignment: .leading, spacing: 8) {
            Text("Playback order").font(.callout.weight(.medium))
            Picker("Playback order", selection: $model.order) {
                Text("Random").tag(PhotoPlaybackSettings.Order.random)
                Text("Custom order").tag(PhotoPlaybackSettings.Order.custom)
            }.pickerStyle(.segmented).labelsHidden().frame(width: 220)
        }
        Button("Save Settings") { model.save(folder: folder) }
            .buttonStyle(.borderedProminent)
            .disabled(model.loadFailed || folder == nil || !model.hasChanges || model.validationMessage != nil)
    }

    private func secondsField(_ title: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.callout.weight(.medium))
            HStack(spacing: 6) {
                TextField(title, text: text).textFieldStyle(.roundedBorder).frame(width: 76)
                Text("sec").foregroundStyle(.secondary)
            }
        }
    }
}
