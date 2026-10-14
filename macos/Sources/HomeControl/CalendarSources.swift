import SwiftUI

struct CalendarSources: View {
    @ObservedObject var model: CompanionModel
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Calendars on your frame").font(.headline)
            Text("Choose one or more calendars. Give each a colour and an optional name.")
                .font(.callout).foregroundStyle(.secondary)
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    ForEach(model.calendars) { source in
                        calendarRow(source)
                        if source.id != model.calendars.last?.id { Divider() }
                    }
                }.padding(.vertical, 4)
            }.frame(maxHeight: .infinity)
            Text("Leave the name blank to show only the time. Changes update your frame while sharing is on.")
                .font(.caption).foregroundStyle(.secondary)
        }.padding(20)
    }

    private func calendarRow(_ source: CalendarSource) -> some View {
        let appearance = model.calendarAppearances[source.id] ?? CalendarAppearance()
        let color = CalendarAppearance.color(from: appearance.frameColor(fallback: source.colorHex)) ?? .systemBlue
        return VStack(alignment: .leading, spacing: 12) {
            Toggle(isOn: Binding(get: { model.selectedCalendars.contains(source.id) }, set: { enabled in
                if enabled { model.selectedCalendars.insert(source.id) } else { model.selectedCalendars.remove(source.id) }
            })) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(source.title).fontWeight(.medium)
                    Text(source.account).font(.caption).foregroundStyle(.secondary)
                }
            }.toggleStyle(.checkbox)
            if model.selectedCalendars.contains(source.id) {
                VStack(alignment: .leading, spacing: 10) {
                    TextField("Name on frame (optional)", text: Binding(get: { model.calendarAppearances[source.id]?.displayName ?? "" }, set: { value in
                        var settings = model.calendarAppearances[source.id] ?? CalendarAppearance()
                        settings.displayName = String(value.prefix(80))
                        model.calendarAppearances[source.id] = settings
                    }))
                    .textFieldStyle(.roundedBorder)
                    .accessibilityLabel("Name on frame for \(source.title)")
                    HStack {
                        ColorPicker("Frame colour", selection: Binding(get: { Color(nsColor: color) }, set: { value in
                            var settings = model.calendarAppearances[source.id] ?? CalendarAppearance()
                            settings.colorHex = CalendarAppearance.hex(from: NSColor(value))
                            model.calendarAppearances[source.id] = settings
                        }), supportsOpacity: false)
                        .accessibilityLabel("Frame colour for \(source.title)")
                        if appearance.colorHex != nil {
                            Button("Reset") {
                                var settings = appearance
                                settings.colorHex = nil
                                model.calendarAppearances[source.id] = settings
                            }.controlSize(.small).help("Use this calendar’s original colour")
                        }
                    }
                    HStack(spacing: 10) {
                        RoundedRectangle(cornerRadius: 2).fill(Color(nsColor: color)).frame(width: 3)
                        Text("6:00pm" + (appearance.frameName.map { " – \($0)" } ?? ""))
                            .font(.system(size: 13, weight: .semibold)).foregroundStyle(Color(nsColor: color))
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 0)
                    }.padding(10).frame(minHeight: 40).background(Color.black, in: RoundedRectangle(cornerRadius: 7))
                }.padding(.leading, 22)
            }
        }
    }
}
